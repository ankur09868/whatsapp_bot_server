import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBPsLD_NgSwchMrpG2U81UsH_USQGSiNZU',
  authDomain: 'nurenai.firebaseapp.com',
  projectId: 'nurenai',
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

// Example function to retrieve data from Firestore
export async function getdata(dataMap) {
  try {
    const docRef = db.collection('whatsapp');
    const docSnapshot = await docRef.get();
    docSnapshot.forEach(doc => {
      const data=doc.data();
      const user_replies=data.user_replies;
      const bot_replies=data.bot_replies;
      const name=data.name;
      dataMap.set(doc.id, [user_replies, bot_replies, name]);
    })
    //console.log(dataMap);
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
}

export async function setdata(key, bot_replies, user_replies, name){
    const kroData = {
        bot_replies: bot_replies,
        user_replies :user_replies,
        name : name
    }

    return db.collection('whatsapp').doc(key).set(kroData).then(() => 
    console.log("new data set into firebase."));
}
