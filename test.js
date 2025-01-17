import axios from "axios";

const commandList = {
    "commands": [
        {
            "command_name": "generate",
            "command_description": "Create a new image"
        },
        {
            "command_name": "rethink",
            "command_description": "Generate new images from existing images"
        }
    ]
};



const response = await axios.post(`https://graph.facebook.com/v19.0/241683569037594/conversational_automation`, commandList);
console.log(response.data.data);
