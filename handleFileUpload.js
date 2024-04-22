import axios from "axios";

async function handleFileUpload(file) {
    try {
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('pdf_file', file);

      // Send a POST request to upload the file
      console.log("test");
      const response = await axios.post('http://nurenai2backend.azurewebsites.net/api/upload-pdf/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("file uploaded successfully");
      // Set the uploaded PDF file and zip file name
      // setPdfFile(file);
      // setZipName(response.data.zip_file_path);
    } catch (error) {
      console.error('Error uploading and converting PDF:', error);
    }
  };

export default handleFileUpload;