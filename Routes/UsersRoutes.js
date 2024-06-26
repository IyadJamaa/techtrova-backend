const express=require("express")
const userController=require("../controllers/userController")
const authenticateuser = require("../middleware/authenticateuser");
const upload = require("../middleware/multerMiddleware");
const uploadToCloudinary = require("../middleware/cloudinaryMiddleware");
const multer =require('multer');
const { protect } = require("../utils/tokenChecker");

const route=express.Router()

module.exports=route

// Middleware setup

const optionalUpload = (req, res, next) => {
    upload.single('profilePhoto')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: 'File upload error' });
        } else if (err) {
            return res.status(500).json({ message: 'Server error during file upload' });
        }
        next();
    });
};

route.post('/user/signup',userController.SignUP)
route.post('/user/signin',userController.SignIN)
route.put('/user/editProfile/:id',optionalUpload,userController.editProfile)
route.post('/user/forgot-password', userController.forgetPassword);
route.post('/user/reset-password/:token',userController.resetPassword);
route.put('/user/changePassword',authenticateuser,userController.changePassword)

route.get('/user/:id', userController.getuserById);





