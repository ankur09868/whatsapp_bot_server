import { conversationData } from "./app.js";
import {getdata,setdata} from "./fromFirestore.js";

async function addConversation(key, botValue, userValue, name){

  await getdata(conversationData);
  
    if(conversationData.has(key)){
      
      const replies=conversationData.get(key);
      const botReplies=replies[1];
      botReplies.push(botValue);
      // botList.push(botValue);
      const userReplies=replies[0];
      userReplies.push(userValue);
      // userList.push(userValue);
      
      if(name && replies[2]===undefined) {
        conversationData.set(key, [userReplies, botReplies, name]);
      }
      else conversationData.set(key, replies);
      
    setdata(key, botReplies, userReplies, name)
    }

    else {
      
      
      const botReplies=[];
      const userReplies=[];
      botReplies.push(botValue);
      // botList.push(botValue);
      userReplies.push(userValue);
      // userList.push(userValue);
      
      if(name){
        
      //   const userName=[];
      //   userName.push(name);
        conversationData.set(key, [userReplies , botReplies , name]);
        
  console.log("map data is " ,conversationData);
      }
      else conversationData.set(key, [botReplies,userReplies]);
      setdata(key, botReplies, userReplies, name)
    }

  }

// addConversation('919548265904');
export default addConversation;