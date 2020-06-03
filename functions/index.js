const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const request = require('request');
const language = require('@google-cloud/language');
const cors = require('cors')({
  origin: true,
});
var twilio = require('twilio');
const twilio_accountSid = 'AC0ffe354bb1064b240f2c38ae8eef3744';
const twilio_authToken = 'f26f395b0220b4e779c68ba6540b3d7f';
var http = require('http');
const MessagingResponse = require('twilio').twiml.MessagingResponse;



//===========TEST FUNCTION======================================================================
//{ INVITE A NEW FRIEND also puts  unique_id into user phone number structure 
//https://us-central1-brutest2-62192.cloudfunctions.net/textMeats
exports.test_text = functions.pubsub.schedule('every 23 hours').onRun((context) => {
	// Grab the unique_id parameter from the GET request
    //unique_id=String(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    var phone = '7174756561';
  	//console.log('New user ' + phone+' created with unique id: '+unique_id);
	const client = require('twilio')(twilio_accountSid, twilio_authToken);


//	console.log('hello');

	var today = new Date();
	var delivery_day = new Date('December 12, 2020 03:24:00');
	var days_left=String(Math.floor((delivery_day-today)/1000/60/60/24));
	
	client.messages.create(
	  {
		to: '+1'+phone,
		from: '+17176960783',
		//body: 'http://www.apple.com/iphone',
		body: 'airplane!',
	  },
	  function(err,message){
		  if(err){
			  console.log(err);
		  }else{
			  console.log(message.sid);
		  }
	  }
	  
	);
	return(0);	
	
});
//}