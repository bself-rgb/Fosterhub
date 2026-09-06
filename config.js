// Second Leash Hub configuration
// Public/publishable Supabase key only. Never put a service_role/secret key here.

const SUPABASE_URL = "https://qkftfbatpijxrhaeaymj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ig8sZiYigMY4ANhtlOFFKA_HGNPsP-u";

/*
  Foster schema compatibility layer.
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
})();
