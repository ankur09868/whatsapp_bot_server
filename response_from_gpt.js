import axios from "axios";

async function response_from_gpt(body, state){
  const url = "https://api.openai.com/v1/chat/completions";
  const api_key = "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";
  const config ={
    headers: {
      "Content-Type" : "application/json",
      "Authorization" : `Bearer ${api_key}`
    }
  }
  var data=""
  if(state=="arrival"){
      data={
        'model' : 'gpt-4',
        'messages' : [
            {'role' : 'user' , 'content' : `is ${body} means the user wants to talk? reply in yes or no only`}
        ]
    }
  }
  else if(state=="change"){
       data={
        'model' : 'gpt-4',
        'messages' : [
            {'role' : 'user' , 'content' : `does ${body} means that the user wants to change mentor? reply in yes or no only`}
        ]
    }
  }
  else if(state=="departure"){ 
     data={
        'model' : 'gpt-4',
        'messages' : [
            {'role' : 'user' , 'content' : `is ${body} similar to bye? reply in yes or no only`}
        ]
    }
  }
  var result="";
    await axios.post(url, data, config).then((response)=>{
      result=response.data.choices[0].message.content;
    })
  .catch((error) => {
      console.error("Error:", error);
    })
  // console.log(result);
  return result;
        
}

export default response_from_gpt;