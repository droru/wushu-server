DButilsAzure = require('./dBUtils');
Constants = require('./constants');
let express = require('express');
let app = express();
let bodyParser = require("body-parser");
let cors = require('cors');
let path = require('path');
jwt = require("jsonwebtoken");
validator = require('validator');

secret = "wushuSecret";
let schedule = require('node-schedule');

global.__basedir = __dirname;

let id, access;
bcrypt = require('bcryptjs');
saltRounds = 10;

//import all modules
const common_couches_module = require("./implementation/common/couches_module");
const common_sportclub_module = require("./implementation/common/sportclub_module");
const common_sportsman_module = require("./implementation/common/sportsman_module");
const common_user_module = require("./implementation/common/user_module");
const common_competition_module = require("./implementation/common/competition_module");

const coach_sportsman_module = require("./implementation/coach/sportsman_module");
const coach_user_module = require("./implementation/coach/user_module");
const coach_competition_module = require("./implementation/coach/competition_module");

const manger_sportsman_module = require("./implementation/manger/sportsman_module");
const manger_user_module = require("./implementation/manger/user_module");
const manger_competition_module = require("./implementation/manger/competition_module");

const sportsman_user_module = require("./implementation/sportsman/user_module");

common_function = require("./implementation/commonFunc");
const excelCreation = require("./implementation/services/excelCreation");

const multer = require('multer');

//uploade file const
const storagePhoto = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/resources/profilePics/')
    },
    filename: (req, file, cb) => {
        cb(null, String("userIdPic" + ".jpeg"))
    }
});
const uploadProfilePic = multer({storage: storagePhoto}).single("profileImage");


/*
app.post('/private/uploadPhoto', uploadProfilePic.single("userProfilePic"), async (req, res) => {
    let ans;
    ans = await common_user_module.uploadeProfilePic(common_user_module.getTabelName(access), id);
    res.status(ans.status).send(ans.results);
});


 */
/*
const uploadMedical = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/sportsman/MedicalScan/')
    },
    filename: (req, file, cb) => {
        cb(null, String(id + ".jpeg"))
    }
});
const uploadInsurance = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __basedir + '/uploads/sportsman/InsuranceScan/')
    },
    filename: (req, file, cb) => {
        cb(null, String(id + ".jpeg"))
    }
});
const uploadPhotos = multer({storage: storagePhoto});
const uploadMedicals = multer({storage: uploadMedical});
const uploadInsurances = multer({storage: uploadInsurance});
app.post('/private/uploadPhoto', uploadPhotos.single("userphoto"), (req, res) => {
    common_user_module._uploadPhoto(req, res);
});
app.post('/private/uploadMedicalFile', uploadMedicals.single("userMedical"), (req, res) => {
    sportsman_user_module._uploadeMedical(req, res);
});
app.post('/private/uploadInsurance', uploadInsurances.single("userInsurance"), (req, res) => {
    sportsman_user_module._uploadInsurances(req, res);
});

 */

//server schedule Jobs
let automaticCloseCompetition = schedule.scheduleJob({hour: 2}, function () {
    manger_competition_module.autoCloseRegCompetition();
});

//app uses
app.use(bodyParser.urlencoded({extend: true}));
app.use(bodyParser.json());
app.use(cors());
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
        res.status(400).send("Invalid token. Permission denied");
    }
});

app.use("/static", express.static(path.join(__dirname, 'resources')));


//app options
app.options('*', cors());


app.post("/login", async (req, res) => {
    let ans = await common_user_module.checkUserDetailsForLogin(req.body);
    if (!ans.isPassed)
        res.status(Constants.statusCode.unauthorized).send(ans.err);
    else {
        let userDetails = await common_user_module.getUserDetails(ans);
        let token = common_user_module.buildToken(userDetails, ans);
        res.status(Constants.statusCode.ok).send(token)
    }
});

app.post("/private/registerSportsman", async function (req, res) {
    if (access === Constants.userType.MANAGER || access === Constants.userType.COACH) {
        let ans = await coach_user_module.checkDataBeforeRegister(common_function.getArrayFromJsonArray(req.body))
        if (ans.users.length === 0) {
            ans.status = Constants.statusCode.badRequest;
            ans.results = [{line: 0, errors: [Constants.errorMsg.emptyExcel]}];
            res.status(ans.status).send(ans.results);
        } else if (ans.isPassed) {
            ans = await coach_user_module.registerSportsman(ans.users);
            res.status(ans.status).send(ans.results);
        } else
            res.status(Constants.statusCode.badRequest).send(ans.results);
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);
});

app.post("/private/uploadUserProfileImage",function (req,res) {
    uploadProfilePic(req,res,function (err) {
        if (err)
            console.log(err)
    })
    console.log("ok")
res.send("ok")
})
app.post("/private/registerCoach", async function (req, res) {
    if (access === Constants.userType.MANAGER) {
        let ans = manger_user_module.checkDataBeforeRegister(common_function.getArrayFromJsonArray(req.body))
        if (ans.users.length === 0) {
            ans.status = Constants.statusCode.badRequest;
            ans.results = [{line: 0, errors: [Constants.errorMsg.emptyExcel]}];
            res.status(ans.status).send(ans.results);
        } else if (ans.isPassed) {
            ans = await manger_user_module.registerCoaches(ans.users);
            res.status(ans.status).send(ans.results);
        } else
            res.status(Constants.statusCode.badRequest).send(ans.results);
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.badRequest)

});


// excel download
app.get('/downloadExcelFormatSportsman/:token', async (req, res) => {
    let token = req.params.token;
    const decoded = jwt.verify(token, secret);
    access = decoded.access;
    id = decoded.id;
    let clubs;
    let coaches;
    if (access == Constants.userType.COACH) {
        clubs = await common_sportclub_module.getSportClubs(id)
        coaches = await common_couches_module.getCoachProfileById(id);
        coaches.results = [coaches.results];
    } else if (access == Constants.userType.MANAGER) {
        clubs = await common_sportclub_module.getSportClubs(undefined);
        coaches = await common_couches_module.getCoaches();
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)

    let excelFile = await excelCreation.createExcelRegisterSportsman(clubs.results, coaches.results);

    res.download(excelFile);


});
app.get('/downloadExcelFormatCoach/:token', async (req, res) => {
    let token = req.params.token;
    const decoded = jwt.verify(token, secret);
    access = decoded.access;
    let clubs;
    if (access === Constants.userType.MANAGER) {
        clubs = await common_sportclub_module.getSportClubs(undefined);
        let excelFile = await excelCreation.createExcelRegisterCoaches(clubs.results);
        res.download(excelFile);
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);

});
app.get('/downloadExcelFormatRegisterToCompetition/:token/:compId', async (req, res) => {
    let token = req.params.token
    const decoded = jwt.verify(token, secret);
    access = decoded.access;
    id = decoded.id;
    let sportsManData;
    if (access == Constants.userType.COACH)
        sportsManData = await coach_sportsman_module.getSportsmen({competition: req.params.compId}, id);
    else if (access == Constants.userType.MANAGER)
        sportsManData = await manger_sportsman_module.getSportsmen({competition: req.params.compId});
    else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
    let categoryData = await common_sportsman_module.getCategories();
    let excelFile = await excelCreation.createExcelRegisterCompetition(sportsManData.results, categoryData.results);
    res.download(excelFile);

});
app.get('/downloadExcelCompetitionState/:token/:compId/:date', async (req, res) => {
    let token = req.params.token;
    const decoded = jwt.verify(token, secret);
    access = decoded.access;
    id = decoded.id;
    let data;
    if (access == Constants.userType.MANAGER) {
        data = await manger_competition_module.getRegistrationState(req.params.compId);
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)

    data = data.results;
    let excelFile = await excelCreation.createExcelCompetitionState(data, req.params.date);

    res.download(excelFile);


});


app.post("/private/regExcelCompetitionSportsmen", async function (req, res) {
    let ans;
    if (access == Constants.userType.COACH || access == Constants.userType.MANAGER) {
        let sportsmenArr = common_function.getArrayFromJsonArray(req.body.sportsman);
        let categoryData = await common_sportsman_module.getCategories();
        let sportsmen = common_competition_module.fixCategoryExcelData(sportsmenArr);
        ans = common_competition_module.cheackExcelData(sportsmenArr, categoryData.results);
        if (sportsmenArr.length == 0)
            res.status(Constants.statusCode.badRequest).send([{error: Constants.errorMsg.emptyExcel}])
        else {
            if (ans.pass) {
                let delSportsman = common_competition_module.getIdsForDelete(sportsmenArr)
                ans = await common_competition_module.excelDelSportsmenDB(delSportsman, req.body.compId);
                if (ans.pass)
                    ans = await common_competition_module.regExcelSportsmenCompDB(sportsmen, req.body.compId);

                res.status(ans.status).send(ans.results)
            } else
                res.status(Constants.statusCode.badRequest).send(ans.results)
        }
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);
});

app.post("/private/getCoachProfile", async function (req, res) {
    let ans;
    if (req.body.id !== undefined)
        ans = await common_couches_module.getCoachProfileById(req.body.id);
    else
        ans = await common_couches_module.getCoachProfileById(id);
    console.log(ans.results)
    res.status(ans.status).send(ans.results)
});


app.post("/private/changePassword", async function (req, res) {
    let userData = {
        id: jwt.decode(req.header("x-auth-token")).id,
        newPass: req.body.password
    }
    let ans = await common_user_module.validateDiffPass(userData);
    if (ans.isPassed) {
        ans = await common_user_module.changeUserPassword(userData);
        res.status(ans.status).send(ans.results)
    } else
        res.status(ans.status).send(ans.err)
});

app.post("/private/getCoaches", async function (req, res) {
    if (access !== Constants.userType.SPORTSMAN) {
        let ans = await common_couches_module.getCoaches();
        res.status(ans.status).send(ans.results);
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);
});

app.post("/private/getSportsmen", async function (req, res) {
    let ans;
    if (access === Constants.userType.MANAGER)
        ans = await manger_sportsman_module.getSportsmen(req.query);
    else if (access === Constants.userType.COACH)
        ans = await coach_sportsman_module.getSportsmen(req.query, id);
    res.status(ans.status).send(ans.results);

});
app.get("/private/getSportsmen/count", async function (req, res) {
    let ans;
    if (access === Constants.userType.MANAGER)
        ans = await manger_sportsman_module.getSportsmenCount(req.query);
    else if (access === Constants.userType.COACH)
        ans = await coach_sportsman_module.getSportsmenCount(req.query, id);
    res.status(ans.status).send(ans.results);

});

app.post("/private/getClubs", async function (req, res) {
    if (access !== Constants.userType.SPORTSMAN) {
        let ans = await common_sportclub_module.getSportClubs();
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);
});

app.post("/private/getCategories", async function (req, res) {
    if (access != Constants.userType.SPORTSMAN) {
        let ans = await common_sportsman_module.getCategories();
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);
});

app.post("/private/sportsmanProfile", async function (req, res) {
    if (req.body.id !== undefined && access === Constants.userType.SPORTSMAN && id !== req.body.id)
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied);
    else {
        let ans;
        if (req.body.id !== undefined)
            ans = await common_sportsman_module.sportsmanProfile(req.body.id);
        else
            ans = await common_sportsman_module.sportsmanProfile(id);
        res.status(ans.status).send(ans.results)
    }
});

app.post("/private/addCompetition", async function (req, res) {
    let ans = new Object();
    if (access === Constants.userType.MANAGER) {
        ans = manger_competition_module.validateCompetitionDetails(req.body)
        if (ans.isPassed) {
            ans = await manger_competition_module.addCompetition(req.body);
            res.status(ans.status).send(ans.results)
        } else
            res.status(Constants.statusCode.badRequest).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
});

app.post("/private/getCompetitions", async function (req, res) {
    if (access === Constants.userType.MANAGER || access === Constants.userType.COACH) {
        let ans = await manger_competition_module.getCompetitions(req.query);
        res.status(ans.status).send(ans.results);
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
});
app.get("/getCompetitions/count", async function (req, res) {
    let ans = await manger_competition_module.getCompetitionsCount(req.query);
    res.status(ans.status).send(ans.results);
});
app.post("/private/getCompetitionDetail", async function (req, res) {
    let ans = await common_competition_module.getDetail(req.body.id);
    res.status(ans.status).send(ans.results)
});

app.post("/private/competitionSportsmen", async function (req, res) {
    let ans;
    if (access == Constants.userType.COACH || access == Constants.userType.MANAGER)
        ans = await common_competition_module.registerSportsmenToCompetition(req.body.insertSportsman, req.body.deleteSportsman, req.body.updateSportsman, req.body.compId);
    res.status(ans.status).send(ans.results)
});

app.post("/private/deleteSportsmanProfile", async function (req, res) {
    if (access === Constants.userType.MANAGER || id === req.body.userID) {
        let ans = await common_user_module.deleteSportsman(req.body.userID)
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
})

app.post("/private/updateSportsmanProfile", async function (req, res) {
        let ans;
        if (access === Constants.userType.MANAGER || id === req.body.id) {
            ans = sportsman_user_module.validateSportsmanData(common_function.getArrayFromJson(req.body));
            if (ans.isPassed)
                ans = await sportsman_user_module.updateSportsmanProfile(ans.data);
            res.status(ans.status).send(ans.results)
        } else
            res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
    }
);

app.post("/private/getRegistrationState", async function (req, res) {
    if (access === Constants.userType.MANAGER || access === Constants.userType.COACH) {
        let ans = await manger_competition_module.getRegistrationState(req.body.compId);
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.unauthorized).send(Constants.errorMsg.accessDenied)
});

app.post("/private/setCategoryRegistration", async function (req, res) {
    let ans;
    if (access === Constants.userType.MANAGER) {
        ans = await manger_competition_module.setCategoryRegistration(common_function.getArrayFromJsonArray(req.body.categoryForSportsman), req.body.compId);
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
});

app.post("/private/closeRegistration", async function (req, res) {
    if (access === Constants.userType.MANAGER) {
        let ans = await manger_competition_module.closeRegistration(req.body.idCompetition);
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
})

app.post("/private/addNewCategory", async function (req, res) {
    let ans;
    if (access === Constants.userType.MANAGER) {
        ans = manger_competition_module.validateDataBeforeAddCategory(req.body)
        if (ans.isPassed)
            ans = await manger_competition_module.addNewCategory(req.body)
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
})

app.post("/private/updateCompetitionDetails", async function (req, res) {
    if (access === Constants.userType.MANAGER) {
        let idEvent = await manger_competition_module.getIdEvent(req.body.competitionId);
        let ans = await manger_competition_module.updateCompetitionDetails(req.body, idEvent);
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.badRequest).send(Constants.errorMsg.accessDenied)
})

app.post("/private/deleteCoachProfile", async function (req, res) {
    if (access === Constants.userType.MANAGER) {
        let ans = await manger_user_module.deleteCoach(req.body.userID)
        res.status(ans.status).send(ans.results)
    } else
        res.status(Constants.statusCode.unauthorized).send(Constants.errorMsg.accessDenied);

})

//start the server
app.listen(process.env.PORT || 3000, () => {
    console.log("Server has been started !!");
    console.log("port 3000");
    console.log("wu-shu project");
    console.log("----------------------------------");
});
