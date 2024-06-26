const bcrypt = require('bcrypt')
const User = require('../models/userSchema');
const userValid = require("../validation/userValidation");
const cloudinary = require("../services/cloudinaryConfig")
const editProfileValidation=require("../validation/editProfileValidation")
const jwt=require('jsonwebtoken');
const { exec } = require('child_process'); 
const nodemailer = require('nodemailer');
const newPasswordValid = require("../validation/ResetPasswordValidation");
const crypto = require('crypto');
const mongoose = require('mongoose');



const SignUP = async function(req, res) {

    if (!req.body.email) {
        return res.status(400).json({ "message": "email is required" });
    }
    let email = req.body.email.toLowerCase();

    // Find the user by email (case-insensitive)
    let emailValidation = await User.findOne({ email: { $regex: new RegExp('^' + email.toLowerCase() + '$', 'i') } });

    if (emailValidation) {
        return res.status(400).json({ message: "Email already exists" });
    }

  
    if (req.body.password !== req.body.re_password) {
        return res.status(400).json({ "message": "passwords do not match" });
    }

    // Create a new user object without hashed passwords
    const newUser = new User({

        userName: req.body.userName,
        email: req.body.email,
        password: req.body.password,
        re_password: req.body.re_password
    });

    // Validate the user object
    const valid = userValid(newUser);
    if (!valid) {
        return res.status(400).json({ message: "Invalid user data" });
    }

    try {
        // Hash the passwords
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        const hashedRePassword = await bcrypt.hash(req.body.re_password, salt);

        // Update the user object with hashed passwords
        newUser.password = hashedPassword;
        newUser.re_password = hashedRePassword;

        // Save user to database
        const userDetails = await newUser.save();

        // Generate JWT token
        const tokenPayload = {
            _id: userDetails._id,
            email: userDetails.email
        };
        const token = jwt.sign(tokenPayload, process.env.privateKey, { expiresIn: '200d' });

        // Send response with user data and token
        res.status(201).json({
            UserData: {
                _id : userDetails._id,
                userName: userDetails.userName,
                email: userDetails.email,
                password: userDetails.password,
                re_password: userDetails.re_password,
                
            },
            token: token
        });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// API endpoint for SignIN
const SignIN = async function(req, res) {
    try {
        let user = await User.findOne({ email: { $regex: new RegExp(`^${req.body.email}$`), $options: 'i' } });
        if (!user) {
            return res.status(401).json({ message: "email or password is incorrect" });
        }

        // Compare passwords
        let isPasswordValid = await bcrypt.compare(req.body.password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "email or password is incorrect" });
        }
        const tokenPayload = {
            _id: user._id,
                email: user.email
        };
        // Generate JWT token
        const token = jwt.sign(tokenPayload, process.env.privateKey, { expiresIn: '200d' });

        // Send response with user data and token
        return res.json({
            UserData: {
                _id : user._id,
                userName: user.userName,
                email: user.email,
                password: user.password,
                re_password: user.re_password,
                profilePhoto:user.profilePhoto
            },
            token: token
        });
    } catch (error) {
        console.error("Error during sign in:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


// API endpoint for Change Password
const changePassword =async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            throw new Error("User not found");
        }
        // Check if the current password matches
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Check if the new password and confirm password match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirm password do not match' });
        }
        const valid = newPasswordValid(req.body);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid request body', errors:newPasswordValid.errors });
        }
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user's password
        user.password = hashedPassword;
        user.re_password=hashedPassword;
        // Save user to database
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error during password change:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


const editProfile = async (req, res) => {
    const { id } = req.params;
    const { profilePhoto, userName, email } = req.body;
    if (!editProfileValidation(req.body)) {
        return res.status(400).json({ message: 'Invalid input'});
    }
    try {
        // Find the logeduser by ID
        let logeduser = await User.findById(id);

        if (!logeduser) {
            return res.status(404).json({ message: 'logeduser not found' });
        }

        let photoUrl = logeduser.profilePhoto;

        // Check if file is uploaded
        if (req.file && req.file.path) {
            // Upload image to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path);
            photoUrl = result.secure_url;
        }

        // Update logeduser's profile with provided data
        logeduser.profilePhoto = photoUrl;
        logeduser.userName = userName || logeduser.userName;
        logeduser.email = email || logeduser.email;
        

        // Save the updated logeduser
        await logeduser.save();

        res.json({ message: 'logeduser profile updated successfully', data: logeduser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};









// Function to generate a random token
const generateToken = () => {
    return crypto.randomBytes(20).toString('hex');
};

const forgetPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate verification code and token
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        const token = generateToken();
        user.resetPasswordVerificationCode = verificationCode;
        user.resetPasswordVerificationToken = token;
        user.resetPasswordVerificationExpires = Date.now() + 300000; // 5 minutes
        await user.save();

        // Send reset email with verification code and token
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'tech.trova1@gmail.com', 
                pass: 'kooz lhar mcch thcj'
            }
        });

        const mailOptions = {
            from: 'tech.trova1@gmail.com',
            to: email,
            subject: 'Reset your password',
            html: `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
                   <p>Your verification code is: <strong style="background-color: #874CCC; font-weight: bold;color:white">${verificationCode}</strong></p>
                   <p>Your reset token is: <strong>${token}</strong></p>
                   <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: 'Error sending email' });
            }
            console.log('Email sent: ' + info.response);
            res.status(200).json({ message: 'Verification code sent successfully' ,token});
        });
    } catch (error) {
        console.error("Error sending verification code:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    try {
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Validate the new password (implement newPasswordValid function as needed)
        const valid = newPasswordValid(req.body);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid request body', errors: newPasswordValid.errors });
        }

        // Find user by token
        const user = await User.findOne({ resetPasswordVerificationToken: token });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash new password and update user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        user.re_password = hashedPassword;
        user.resetPasswordVerificationCode = undefined;
        user.resetPasswordVerificationToken = undefined;
        user.resetPasswordVerificationExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const getuserById = async (req, res) => {
    const { id } = req.params;
    console.log("Received ID:", id); 
     // Validate the ID
     if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID format' });
    }


    try {
        // Find the user by ID
        let user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'user not found' });
        }

        // Return the user data
        res.json({ message: 'user found', data: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};
const getuserByToken = async function(req, res) {
    try {
        const token = req.params.token;
        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }

        // Verify and decode the token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.privateKey);
        } catch (error) {
            return res.status(401).json({ message: "Invalid token" });
        }

        // Find the user by decoded token payload
        const user = await User.findById(decoded._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Send response with user data
        return res.json({
            UserData: {
                _id:user._id,
                userName: user.userName,
                email: user.email,
                password: user.password,
                re_password: user.re_password,
                
            }
        });
    } catch (error) {
        console.error("Error retrieving patient by token:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


module.exports = {SignUP,SignIN,forgetPassword,resetPassword,changePassword,editProfile,getuserById,getuserByToken}; 