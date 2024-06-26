const mongoose = require('mongoose'); 
var valid = require("validator");

const userSchema = new mongoose.Schema({
    profilePhoto: {type:String},
    userName :{type:String, required:true, minlength:3, maxlength:20}, 
    

    email : {
        type:String,
        required:true, 
        validate:{
            validator:(val)=>{return valid.isEmail(val)},
            message:"{Email} Not Valid"
        },
        unique : true 
    }, 

    password : {type:String,required:true},
    re_password : {type:String,required:true}, 


    resetPasswordVerificationCode: Number,
    resetPasswordVerificationExpires: Date,
    resetPasswordVerificationToken:String
    
    
})

const usermodel =  mongoose.model('user', userSchema)

module.exports=usermodel