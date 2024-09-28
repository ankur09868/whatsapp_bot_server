

const travel_ticket_prompt = `
Given this flight/train/travel ticket. Identify the follwoing (if exists):
destinantion, 
source, 
arrival and departure time, 
duration of trip, 
name of the person traveling,
date of the journey,
type of journey (flight/train/by road)

return the answer in json format. if any of the field is missing, return null in its place

if you dont know the answer, return an empty json object. dont include any apologies or any other statements in your response
`;

const appointment_prompt = `
Given this appointment receipt. Identify the following (if exists):
name of the person,
appointment date,
name of the doctor,
location,
appointment fee.

return the answer in json format. if any of the field is missing, return null in its place

if you dont know the answer, return an empty json object. dont include any apologies or any other statements in your response

`

export {travel_ticket_prompt, appointment_prompt}