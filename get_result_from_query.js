import axios from "axios";

async function get_result_from_query(query, zipName, prompt){
  const url = "https://nurenai2backend.azurewebsites.net/api/get-pdf/";
  const config ={
    headers: {
      "Content-Type" : "application/json"
    }
  }
  // console.log(query);
  const data ={
    'message' : query,
    'zipName' : zipName,
    'prompt' : prompt,
  }
  var result="";
    await axios.post(url, data, config).then((response)=>{
      result=response.data.answer;
    })
  .catch((error) => {
      console.error("Error:", error);
    })
  return result;
  
}
export default get_result_from_query;