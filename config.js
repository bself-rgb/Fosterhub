// Second Leash Hub configuration
// Public/publishable Supabase key only. Never put a service_role/secret key here.

const SUPABASE_URL = "https://qkftfbatpijxrheaymj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ig8sZiYigMY4ANhtlOFFKA_HGNPsP-u";

/*
  Foster schema compatibility + login safety layer.
  The fosters table requires id and uses transportation_available.
  The older form also creates a temporary transportation field; that field
  must never be sent to Supabase.
*/
(function installHubSafety(){
  if(!window.supabase || !window.supabase.createClient){
    console.error("Second Leash: Supabase library did not load.");
    return;
  }

  const originalCreateClient = window.supabase.createClient;

  window.supabase.createClient = function(url, key, options){
    const client = originalCreateClient.call(this, url, key, options);
    window.secondLeashClient = client;

    const originalFrom = client.from.bind(client);

    client.from = function(table){
      const query = originalFrom(table);

      if(table !== "fosters"){
        return query;
      }

      const cleanFosterData = function(values, forInsert){
        if(Array.isArray(values)){
          return values.map(value => cleanFosterData(value, forInsert));
        }

        if(values && typeof values === "object"){
          const cleaned = {...values};

          // This is not a column in the fosters table.
          delete cleaned.transportation;

          // The id column is required for inserts.
          if(forInsert && !cleaned.id){
            if(window.crypto && typeof window.crypto.randomUUID === "function"){
              cleaned.id = window.crypto.randomUUID();
            }else{
              cleaned.id = "sl-" + Date.now() + "-" + Math.random().toString(36).slice(2);
            }
          }

          return cleaned;
        }

        return values;
      };

      // Use a Proxy so the override works even though Supabase exposes
      // insert/update through the query builder's prototype.
      return new Proxy(query, {
        get(target, property, receiver){
          if(property === "insert"){
            return function(values, ...args){
              return target.insert.call(
                target,
                cleanFosterData(values, true),
                ...args
              );
            };
          }

          if(property === "update"){
            return function(values, ...args){
              return target.update.call(
                target,
                cleanFosterData(values, false),
                ...args
              );
            };
          }

          return Reflect.get(target, property, receiver);
        }
      });
    };

    return client;
  };

  /*
    Login safety.
    Intercept the login form before the older app handler so a failed
    request produces a visible, useful error instead of doing nothing.
  */
  document.addEventListener("DOMContentLoaded", function(){
    const form = document.getElementById("loginForm");
    const button = form?.querySelector("button[type='submit']");
    const errorBox = document.getElementById("loginError");

    if(!form || !button || !errorBox){
      return;
    }

    form.addEventListener("submit", async function(e){
      e.preventDefault();
      e.stopImmediatePropagation();

      errorBox.style.display = "none";
      errorBox.textContent = "";
      button.disabled = true;
      button.textContent = "Signing in...";

      try{
        const client = window.secondLeashClient;

        if(!client){
          throw new Error("The Supabase client was not initialized. Please refresh the page.");
        }

        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value || "";

        if(!email || !password){
          throw new Error("Please enter your email and password.");
        }

        const result = await client.auth.signInWithPassword({
          email,
          password
        });

        if(result.error){
          throw result.error;
        }

        if(!result.data?.user){
          throw new Error("Supabase did not return a signed-in user.");
        }

        if(typeof window.startApp === "function"){
          await window.startApp(result.data.user);
        }else{
          throw new Error("The Hub application did not finish loading. Please refresh the page.");
        }

      }catch(error){
        console.error("Second Leash sign-in error:", error);
        errorBox.textContent = error?.message || String(error) || "Sign-in failed.";
        errorBox.style.display = "block";
      }finally{
        button.disabled = false;
        button.textContent = "Sign In";
      }
    }, true);
  });
})();
