const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: 'tech.trova1@gmail.com',
    pass: 'kooz lhar mcch thcj'
  }
});

async function sendNotification(recipient, subject, message) {
  const info = await transporter.sendMail({
    from: 'tech.trova1@gmail.com',
    to: recipient,
    subject,
    text: message
  });

  console.log('Notification sent:', info.response);
}

module.exports = sendNotification;