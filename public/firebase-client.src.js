import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence, getIdToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
const config=window.NIYET_FIREBASE_CONFIG;
const localFallback=!config||!config.apiKey||config.apiKey.startsWith('PASTE_');
if(localFallback){
 window.niyetApi=async(path,method='GET',body)=>{const response=await fetch('/api/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let result;try{result=await response.json()}catch{throw new Error('Firebase баптауын толтыр немесе жергілікті серверді іске қос.')}if(!response.ok)throw new Error(result.error||result.message||'Әрекет орындалмады.');return result};
 window.niyetFirebaseReady=Promise.resolve();
}else{
 const app=initializeApp(config),auth=getAuth(app),call=httpsCallable(getFunctions(app,'asia-southeast1'),'niyetApi');
 window.niyetFirebaseReady=(async()=>{await setPersistence(auth,browserLocalPersistence);if(!auth.currentUser)await signInAnonymously(auth)})();
 window.niyetApi=async(path,method='GET',body)=>{await window.niyetFirebaseReady;const parsed=new URL(path,'https://niyet.local'),result=await call({path:parsed.pathname+parsed.search,method,body:body||{},groupId:localStorage.getItem('niyet.groupId')||''});return result.data};
 window.niyetAdminRefresh=async()=>{if(auth.currentUser)await getIdToken(auth.currentUser,true)};
}
