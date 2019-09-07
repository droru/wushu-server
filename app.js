DButilsAzure = require('./dBUtils');
var app =require ("express")();
var bodyParser = require("body-parser");
var Enum = require('enum');
var cors = require('cors');
jwt = require("jsonwebtoken");
validation = require('node-input-validator');
secret = "wushuSecret";
const multer = require('multer');


//import all modules
const common_couches_module = require("./implementation/common/couches_module");
const common_sportclub_module = require("./implementation/common/sportclub_module");
const common_sportsman_module = require("./implementation/common/sportsman_module");
const common_user_module = require("./implementation/common/user_module");

const coach_sportsman_module = require("./implementation/coach/sportsman_module");
const coach_user_module = require("./implementation/coach/user_module");

const manger_sportsman_module =require("./implementation/manger/sportsman_module");
const manger_user_module =require("./implementation/manger/user_module");

const sportsman_user_module = require("./implementation/sportsman/user_module");

//userType = new Enum({'Manger': 1, 'Coach': 2, 'sportsman': 3});
userType = {
    MANAGER: 1,
    COACH: 2,
    SPORTSMAN: 3
};
global.__basedir = __dirname;

app.use(bodyParser.urlencoded({extend:true}));
app.use(bodyParser.json());
app.use(cors())
app.options('*', cors())

let id, access;
app.use("/private", (req, res, next) => {
    const token = req.header("x-auth-token");
    if (!token) res.status(401).send("Access denied. No token provided.");
    try {
        const decoded = jwt.verify(token, secret);
        req.decoded = decoded;

        access = jwt.decode(req.header("x-auth-token")).access;
        id = jwt.decode(req.header("x-auth-token")).id;

        next();
    } catch (exception) {
        console.log(token)
        res.status(400).send("Invalid token.");
    }
});
app.post("/login", (req, res) => {
    common_user_module._login(req, res)
});

app.post("/private/registerSportman", function(req, res){
    if(access !== userType.SPORTSMAN)
        coach_user_module._registerSportman(req,res);
    else
        res.status(400).send("Permission denied");
});
app.post("/private/registerCoach",function (req,res) {
    if(access === userType.MANAGER)
        manger_user_module._registerCoach(req,res);
    else
        res.status(400).send("Permission denied")

});

const storagePhoto = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/Photos/')
    },
    filename: (req, file, cb) => {
        cb(null, String(id+".jpeg"))
    }
});
const uploadMedical = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/sportsman/MedicalScan/')
    },
    filename: (req, file, cb) => {
        cb(null, String(id+".jpeg"))
    }
});
const uploadInsurance = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/sportsman/InsuranceScan/')
    },
    filename: (req, file, cb) => {
        cb(null, String(id+".jpeg"))
    }
});
const uploadPhotos = multer({storage: storagePhoto});
const uploadMedicals = multer({storage: uploadMedical});
const uploadInsurances=multer({storage: uploadInsurance});
app.post('/private/uploadPhoto', uploadPhotos.single("userphoto"), (req, res) =>{
    common_user_module._uploadPhoto(req,res);
});
app.post('/private/uploadMedicalFile', uploadMedicals.single("userMedical"), (req, res) =>{
    sportsman_user_module._uploadeMedical(req,res);
});
app.post('/private/uploadInsurance', uploadInsurances.single("userInsurance"), (req, res) =>{
    sportsman_user_module._uploadInsurances(req,res);
});

app.get('/downloadExcelSportsman', (req, res) =>{
    common_user_module._downloadSportsmanExcel(req,res);
});
app.get('/downloadExcelCoach', (req, res) =>{
    common_user_module._downloadcoachExcel(req,res);
});

app.post("/private/changePassword",function (req,res) {
    common_user_module._changePass(req,res)
});

app.post("/private/getCoaches",function (req,res) {
    if(access !== userType.SPORTSMAN)
        common_couches_module._getCoaches(req, res);
    else
        res.status(400).send("Permission denied");
});
app.post("/private/getSportsmen", function (req, res) {
    if(access === userType.MANAGER)
        manger_sportsman_module._getSportsmen(req, res);
    else if(access === userType.COACH)
        coach_sportsman_module._getSportsmen(req, res, id);
});
app.post("/private/getClubs",function (req,res) {
    if(access !== userType.SPORTSMAN)
        common_sportclub_module._getSportClubs(req, res);
    else
        res.status(400).send("Permission denied");
});

app.post("/private/sportsmanProfile",function (req,res) {
    if(access === userType.SPORTSMAN && id !== req.body.id)
        res.status(400).send("Permission denied");
    else
        common_sportsman_module._sportsmanProfile(req, res);
});


//start the server
app.listen(3000,()=>{
    console.log("Server has been started !!");
    console.log("port 3000");
    console.log("wu-shu project");
    console.log("----------------------------------");
});