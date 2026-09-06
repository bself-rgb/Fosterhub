// Second Leash Hub configuration
// Public/publishable Supabase key only. Never put a service_role/secret key here.

const SUPABASE_URL = "https://qkftfbatpijxrheaymj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ig8sZiYigMY4ANhtlOFFKA_HGNPsP-u";

/*
  Login safety + foster schema compatibility layer
  -------------------------------------------------
  The fosters table uses transportation_available and requires an id.
  Older UI code attempted to send a separate transportation field and did
  not provide an id when inserting. Normalize both issues here so the
  existing UI can keep working without duplicating the logic.
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

      if(table === "fosters"){
        const originalInsert = query.insert.bind(query);
        const originalUpdate = query.update.bind(query);

        const cleanFosterData = function(values, forInsert = false){
          if(Array.isArray(values)){
            return values.map(value => cleanFosterData(value, forInsert));
          }

          if(values && typeof values === "object"){
            const cleaned = {...values};

            // The actual table column is transportation_available.
            delete cleaned.transportation;

            // The fosters table requires a non-null id and does not appear
            // to have a database default. Generate one for new records.
            if(forInsert && !cleaned.id){
              cleaned.id = crypto.randomUUID();
            }

            return cleaned;
          }

          return values;
        };

        query.insert = function(values, ...args){
          return originalInsert(cleanFosterData(values, true), ...args);
        };

        query.update = function(values, ...args){
          return originalUpdate(cleanFosterData(values, false), ...args);
        };
      }

      return query;
    };

    return client;
  };

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
