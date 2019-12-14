const checkUserData = require("../services/commonExcelDataCheck");
const pass = require("../coach/user_module")
async function insertNewJudgeDB(trans, judges, judge, number) {
    return trans.sql(` INSERT INTO user_Judge (id, firstname, lastname, phone, email,photo)
                                    VALUES (@idSportsman, @firstName, @lastName, @phone, @email ,@photo)`)
        .parameter('idSportsman', tediousTYPES.Int, judge[Constants.colRegisterJudgeExcel.id])
        .parameter('firstName', tediousTYPES.NVarChar, judge[Constants.colRegisterJudgeExcel.firstName])
        .parameter('lastName', tediousTYPES.NVarChar, judge[Constants.colRegisterJudgeExcel.lastName])
        .parameter('phone', tediousTYPES.NVarChar, judge[Constants.colRegisterJudgeExcel.phone])
        .parameter('email', tediousTYPES.NVarChar, judge[Constants.colRegisterJudgeExcel.email])
        .parameter('photo', tediousTYPES.NVarChar, Constants.defaultProfilePic)
        .execute()
        .then(async function (testResult) {
            if (number + 1 < judges.length)
                await insertNewJudgeDB(trans, judges, judge[number + 1], number + 1)
            return testResult
        })
}
async function registerNewJudge(judges) {
    let ans = new Object()
    let trans;
    await dbUtils.beginTransaction()
        .then(async (newTransaction) => {
            trans = newTransaction;
            await Promise.all(await insertNewJudgeDB(trans, judges, judges[0], 0), await pass.insertPasswordDB(trans, judges, judges[0], 0, Constants.userType.JUDGE)
                .then((result) => {
                    //sendEmail(users);
                    ans.status = Constants.statusCode.ok;
                    ans.results = Constants.msg.registerSuccess;
                    trans.commitTransaction();
                })
                .catch((err) => {
                    ans.status = Constants.statusCode.badRequest;
                    ans.results = err;
                    trans.rollbackTransaction();
                }))
        })
        .fail(function (err) {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
            trans.rollbackTransaction();
        });

    return ans
}

function checkJudgeDataBeforeRegister (judges){
    let errorUsers = []
    let res = new Object();
    res.isPassed = true;
    let line = 1;
    let tmpErr = new Object();

    judges.forEach(function (user) {
        console.log(user)
        line++
        if (user.length != Constants.colRegisterJudgeExcel.numCell) {
            tmpErr = new Object();
            res.isPassed = false;
            tmpErr.errors = [Constants.errorMsg.cellEmpty]
        } else {
            tmpErr = checkUser(user)
        }
        if (tmpErr.errors.length > 0) {
            tmpErr.line = line;
            errorUsers.push(tmpErr)
            res.isPassed = false;
        }
    })
    res.results = errorUsers;
    res.data = judges;

    return res;
}
function checkUser(user) {
    let err = new Object()
    let collectErr = [];

    //id user
    if (!checkUserData.checkIdUser(user[Constants.colRegisterJudgeExcel.id]))
        collectErr.push(Constants.errorMsg.idSportmanErr)
/*
    //firstname
    if (!checkUserData.checkFirstNameLastName(user[Constants.colRegisterJudgeExcel.firstName]))
        collectErr.push(Constants.errorMsg.firstNameHeb)

 */

    //lastname
    if (!checkUserData.checkFirstNameLastName(user[Constants.colRegisterJudgeExcel.lastName]))
        collectErr.push(Constants.errorMsg.lastNameHeb)

    //phone
    if (!checkUserData.checkPhone(user[Constants.colRegisterJudgeExcel.phone]))
        collectErr.push(Constants.errorMsg.phoneErr)
    //email
    if (!checkUserData.checkEmail(user[Constants.colRegisterJudgeExcel.email]))
        collectErr.push(Constants.errorMsg.emailErr)

    err.errors = collectErr;
    return err;


}

function cleanCoachAsJudgeExcelData (data) {
   let judges =[];
    data.forEach((judge)=>{
       if(judge.length==4)
           judges.push(judge[0])
   })
    return judges;
}

async function registerCoachAsJudge (judges){
    let ans = new Object();
    let trans;
    await dbUtils.beginTransaction()
        .then(async function (newTransaction) {
            trans = newTransaction;
            return trans.sql(`Insert into user_Judge (id,firstname,lastname,phone,photo,email)
                        SELECT id, firstname, lastname, phone,photo,email
                        from user_Coach
                        where id in (${judges})`)
                .returnRowCount()
                .execute();
        })
        .then(async function (testResult) {
            ans.status = Constants.statusCode.ok;
            ans.results =Constants.msg.registerSuccess
            trans.commitTransaction();
        })
        .fail(function (err) {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
            trans.rollbackTransaction();
        })
    return ans;
}



module.exports.registerNewJudge = registerNewJudge;
module.exports.checkJudgeDataBeforeRegister=checkJudgeDataBeforeRegister;
module.exports.cleanCoachAsJudgeExcelData=cleanCoachAsJudgeExcelData;
module.exports.registerCoachAsJudge=registerCoachAsJudge;