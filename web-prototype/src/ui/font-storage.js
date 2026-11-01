// Fonts stay in this origin's IndexedDB, separate from small JSON settings.
let connection;
function openFonts(){
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('between-fonts',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('fonts',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Font storage is blocked.'));
  });
  return connection;
}
export async function storedFonts(){try{const db=await openFonts();return await new Promise((resolve,reject)=>{const request=db.transaction('fonts').objectStore('fonts').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}catch{return[];}}
export async function storeFont(record){try{const db=await openFonts();await new Promise((resolve,reject)=>{const transaction=db.transaction('fonts','readwrite');transaction.objectStore('fonts').put(record);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});return true;}catch{return false;}}
