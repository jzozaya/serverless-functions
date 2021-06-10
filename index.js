const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const cors = require("cors")({ origin: 'https://domain.com' });
const stripe = require("stripe")(functions.config().stripe.secret);
const eeClient = require('elasticemail-webapiclient').client;

exports.createConnectWorker = functions.https.onRequest( (req, res) => {
    cors (req, res, async () => {
      
      if (req.method !== "POST") {
        res.status(400).send("Please send a POST request");
        return;
      }
  
      const data = req.body;
  
      if (!data.hasOwnProperty("email") || !data.email) {
        res.status(400).send("Email address is required");
        return;
      }
  
      if (!data.hasOwnProperty("uid") || !data.uid) {
        res.status(400).send("Id is required");
        return;
      }

      try {
        const account = await stripe.accounts.create({
              country: 'US',
              type: 'express',
              capabilities: {
                transfers: {
                  requested: true,
                },
              },
            });

            try {
              const accountLink = await stripe.accountLinks.create({
                type: "account_onboarding",
                account: account.id,
                refresh_url: 'https://domain.com/onboarding-error/',
                return_url: 'https://domain.com/dashboard?success=true',
              });
              
              res.status(200).send({ accountId: account.id, accountLink: accountLink});
              
            } catch (err) {
              res.status(500).send({
                error: err.message
              });
            }
        
      } catch (err) {
        res.status(500).send({
          error: err.message
        });
      }

    });
});

exports.sendEmailNotification = functions.firestore.document('notifications/{id}').onCreate(async (snap, context) => {

  const source = snap.data();
  const notification = source.type;
  let emailBody;

  const img = "add your cdn url"

  const bottom = `<br>
                <img style="weight:50px; height:50px;"src=${img}>
                <p>If you have any questions please send an email to info@domain.com</p>
                `

  if(source.visibleFor == 'business'){

    try{
      const snapshot = await admin.firestore().collection('business').doc(source.businessId).get();
      const businessData = snapshot.data();

      if(notification === 'worker_application'){

        emailBody = {
          subject: "Someone has applied to your gig 🔔",
          body: `<h3>Hi ${ businessData.firstName },</h3>
              <p>${ source.workerName } has applied to the gig ${ source.gigName }. Check your notifications to respond to the application.</p>
              <br><div style="margin-bottom:1rem">
                  <a href="https://domain.com/business-dashboard" style="text-decoration: none; background-color: rgba(204, 243, 129); padding: 0.5rem 0.75rem 0.5rem 0.75rem; margin: 1rem 0rem 1rem 0rem">View Dashboard</a>
              </div>
              ${bottom}
              `
          }
      }

      
      if(notification === 'worker_rejected_gig'){

        emailBody = {
          subject: `${ source.workerName } is not available for ' ${ source.gigName } 🚨`,
          body: `<h3>Hi ${ businessData.firstName },</h3>
              <p>${ source.workerName } is not available for ${ source.gigName }, please try to hire another applicant.</p>
              <br><div style="margin-bottom:1rem">
                  <a href="https://domain.com/business-dashboard" style="text-decoration: none; background-color: rgba(204, 243, 129); padding: 0.5rem 0.75rem 0.5rem 0.75rem; margin: 1rem 0rem 1rem 0rem">View Dashboard</a>
              </div>
              ${bottom}
              `
          }
      }

      if(notification === 'rate_review'){

        emailBody = {
          subject: `${ source.workerName } has rated your business 🌟`,
          body: `<h3>Hi ${ businessData.firstName },</h3>
              <p>${ source.workerName } rated your business.</p>
              <br><div style="margin-bottom:1rem">
                  <a href="https://domain.com/business-dashboard" style="text-decoration: none; background-color: rgba(204, 243, 129); padding: 0.5rem 0.75rem 0.5rem 0.75rem; margin: 1rem 0rem 1rem 0rem">View Dashboard</a>
              </div>
              ${bottom}
              `
          }   
      }
      
      try {
        const options = {
          apiKey: functions.config().elastic.api_key,
          apiUri: 'https://api.elasticemail.com/',
          apiVersion: 'v2'
        };
      
        const EE = new eeClient(options);
        
        const send = await EE.Email.Send({
          "subject": emailBody.subject,
          "to": businessData.email,
          "from": 'info@domain.com',
          "bodyHtml": emailBody.body
        });
    
        return send;
    
      } catch (err) {
        return null;
      }
  
    } catch (err) {
      return null;
    }
  }else{

    try{
      const snapshot = await admin.firestore().collection('workers').doc(source.workerId).get();
      const workerData = snapshot.data();

      if(notification === 'application_accepted'){

        emailBody = {
          subject: `You are hired for ${ source.gigName } 🎉!`,
          body: `<h3>Hi ${ workerData.firstName },</h3>
              <p>You were hired for ${ source.gigName } by ${ source.businessName }. Please check the Gig’s information below:</p>
              <p>${source.description}</p>
              <br><p>Please comfirm your availability and remember to rate the business after the gig has been completed.</p>
              <br><div style="margin-bottom:1rem">
                  <a href="https://domain.com/dashboard" style="text-decoration: none; background-color: rgba(204, 243, 129); padding: 0.5rem 0.75rem 0.5rem 0.75rem; margin: 1rem 0rem 1rem 0rem">View Dashboard</a>
              </div>
              ${bottom}
              `
          }
      }

      if(notification === 'rate_review'){

        emailBody = {
          subject: `${ source.businessName } has rated your performance 🌟`,
          body: `<h3>Hi ${ workerData.firstName },</h3>
              <p>${ source.businessName } rated your performance in ${ source.gigName }</p>
              <br><div style="margin-bottom:1rem">
                  <a href="https://domain.com/dashboard" style="text-decoration: none; background-color: rgba(204, 243, 129); padding: 0.5rem 0.75rem 0.5rem 0.75rem; margin: 1rem 0rem 1rem 0rem">View Dashboard</a>
              </div>
              ${bottom}
              `
          }
      }

      try {
        const options = {
          apiKey: functions.config().elastic.api_key,
          apiUri: 'https://api.elasticemail.com/',
          apiVersion: 'v2'
        };
      
        const EE = new eeClient(options);
        
        const send = await EE.Email.Send({
          "subject": emailBody.subject,
          "to": workerData.email,
          "from": 'info@domain.com',
          "bodyHtml": emailBody.body
        });
    
        return send;
    
      } catch (err) {
        return null;
      }
  
    } catch (err) {
      return null;
    }
  }
});


exports.createPaymentIntent = functions.https.onRequest( (req, res) => {
  cors (req, res, async () => {
    if (req.method !== "POST") {
      res.status(400).send("Please send a POST request");
      return;
    }

    const roundedNumber = ( val ) => {
      return Number.parseFloat(val).toFixed(0);
    };

    const data = req.body;

    if (!data.hasOwnProperty("destinationId") || !data.destinationId) {
      res.status(400).send("Id is required");
      return;
    }

    if (!data.hasOwnProperty("description") || !data.description) {
      res.status(400).send("description is required");
      return;
    }

    if (!data.hasOwnProperty("amount") || !data.amount) {
      res.status(400).send("amount is required");
      return;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        payment_method_types: ['card'],
        amount: roundedNumber( data.amount * 100 ),
        currency: 'USD',
        application_fee_amount: 0,
        description: data.description,
        transfer_data: {
          destination: data.destinationId, 
        },
      });
      
      res.status(200).send({paymentIntent: paymentIntent});
      
    } catch (err) {
      res.status(500).send({
        error: err.message
      });
    }

  });
});

exports.getAccountData = functions.https.onRequest( (req, res) => {
  cors (req, res, async () => {
    
    if (req.method !== "POST") {
      res.status(400).send("Please send a POST request");
      return;
    }

    const data = req.body;

    if (!data.hasOwnProperty("email") || !data.email) {
      res.status(400).send("Email is required");
      return;
    }

    if (!data.hasOwnProperty("stripeId") || !data.stripeId) {
      res.status(400).send("stripeId is required");
      return;
    }

    try {
      const account = await stripe.accounts.retrieve(data.stripeId);

      try {
        const accountLink = await stripe.accounts.createLoginLink(data.stripeId);
  
        res.status(200).send({ account: account, accountLink: accountLink});
        
      } catch (err) {
        res.status(500).send({
          error: err.message
        });
      }
      
    } catch (err) {
      res.status(500).send({
        error: err.message
      });
    }
  });
});