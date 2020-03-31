let manger_compModule = require('../manger/competition_module');

async function getDetails(compId) {
    let ans = new Object();
    await dbUtils.sql(`select events_competition.idCompetition,events_competition.description,events_competition.sportStyle ,events_competition.status ,events_competition.closeRegDate, events_competition.closeRegTime, events.date ,events.location, events.startHour, events.city from events_competition
                                   left join events on events_competition.idEvent = events.idEvent
                                   where idCompetition= @compId`)
        .parameter('compId', tediousTYPES.Int, compId)
        .execute()
        .then((results) => {
            ans.status = Constants.statusCode.ok;
            ans.results = results[0]
        })
        .fail((err) => {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err
        });
    return ans;
}

async function insertSportsmanToCompetitonDB(trans, insertSportsman, sportsmanDetails, i, compId) {
    if (sportsmanDetails != undefined)
        return trans.sql(`INSERT INTO competition_sportsman (idCompetition, idSportsman, category)
                     SELECT * FROM (select @compId as idCompetition, @id as idSportsman, @category as category) AS tmp
                     WHERE NOT EXISTS (
                     SELECT idCompetition, idSportsman, category FROM competition_sportsman WHERE idCompetition = @compId and idSportsman = @id and category = @category)`)
            .parameter('compId', tediousTYPES.Int, compId)
            .parameter('id', tediousTYPES.Int, sportsmanDetails.id)
            .parameter('category', tediousTYPES.NVarChar, sportsmanDetails.category)
            .execute()
            .then(async function (testResult) {
                if (i + 1 < insertSportsman.length) {
                    await insertSportsmanToCompetitonDB(trans, insertSportsman, insertSportsman[i + 1], i + 1, compId)
                }
                return testResult
            })
    return;
}

async function deleteSportsmanFromCompetitionDB(trans, insertSportsman, sportsmanDetails, i, compId) {
    if (sportsmanDetails != undefined)
        return trans.sql(`DELETE FROM competition_sportsman WHERE idCompetition=@compId and idSportsman = @id and category = @category;`)
            .parameter('compId', tediousTYPES.Int, compId)
            .parameter('id', tediousTYPES.Int, sportsmanDetails.id)
            .parameter('category', tediousTYPES.NVarChar, sportsmanDetails.category)
            .execute()
            .then(async function (testResult) {
                if (i + 1 < insertSportsman.length)
                    await deleteSportsmanFromCompetitionDB(trans, insertSportsman, insertSportsman[i + 1], i + 1, compId)
                return testResult
            })
    return;
}

async function updateSportsmanInCompetitionDB(trans, updateSportsman, sportsmanDetails, i, compId) {
    if(sportsmanDetails != undefined)
        return trans.sql(`update competition_sportsman
                      set category = @category, isDeleted = @isDeleted
                      where idSportsman = @idSportsman and idCompetition = @idCompetition and category = @oldCategory`)
            .parameter('idSportsman', tediousTYPES.Int, sportsmanDetails.id)
            .parameter('category', tediousTYPES.Int, sportsmanDetails.category)
            .parameter('isDeleted', tediousTYPES.Bit, sportsmanDetails.isDeleted ? 1 : 0)
            .parameter('idCompetition', tediousTYPES.Int, compId)
            .parameter('oldCategory', tediousTYPES.Int, sportsmanDetails.oldCategory)
            .execute()
            .then(async function (testResult) {
                if (i + 1 < updateSportsman.length)
                    await updateSportsmanInCompetitionDB(trans, updateSportsman, updateSportsman[i + 1], i + 1, compId);
                return testResult
            });
    return;
}


async function reRangeCompetitionSportsman(compId) {
    let sportsmanList = (await manger_compModule.getRegistrationState(compId)).results;

    console.log(sportsmanList)

}

async function registerSportsmenToCompetition(insertSportsman, deleteSportsman, updateSportsman, compId) {
    let ans = new Object()
    let trans;
    await dbUtils.beginTransaction()
        .then(async (newTransaction) => {
            trans = newTransaction;
            await Promise.all(insertSportsman && insertSportsman[0] ? await insertSportsmanToCompetitonDB(trans, insertSportsman, insertSportsman[0], 0, compId) : '',
                await deleteSportsmanFromCompetitionDB(trans, deleteSportsman, deleteSportsman[0], 0, compId),
                    await updateSportsmanInCompetitionDB(trans, updateSportsman, updateSportsman[0], 0, compId)
                    .then(async (result) => {
                        //sendEmail(users);
                        ans.status = Constants.statusCode.ok;
                        ans.results = Constants.msg.registerSuccess;
                        trans.commitTransaction();
                        await reRangeCompetitionSportsman(compId)
                    })
                    .catch((err) => {
                        console.log(err)
                        ans.status = Constants.statusCode.badRequest;
                        ans.results = err;
                        trans.rollbackTransaction();
                    }))
        })
        .fail(function (err) {
            console.log(err)
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
            trans.rollbackTransaction();
        })

    return ans

}

function fixCategoryExcelData(data) {
    let regSportsman = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].length > 1) {
            if (data[i][Constants.colRegisterCompetitionExcel.category1] != "" && data[i][Constants.colRegisterCompetitionExcel.category1] != undefined)
                regSportsman.push({
                    id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                    category: getIdFromCategroyString(data[i][Constants.colRegisterCompetitionExcel.category1])
                });
            if (data[i][Constants.colRegisterCompetitionExcel.category2] != "" && data[i][Constants.colRegisterCompetitionExcel.category2] != undefined)
                regSportsman.push({
                    id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                    category: getIdFromCategroyString(data[i][Constants.colRegisterCompetitionExcel.category2])
                });
            if (data[i][Constants.colRegisterCompetitionExcel.category3] != "" && data[i][Constants.colRegisterCompetitionExcel.category3] != undefined)
                regSportsman.push({
                    id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                    category: getIdFromCategroyString(data[i][Constants.colRegisterCompetitionExcel.category3])
                });
        }
    }
    return regSportsman;
}

async function regExcelSportsmenCompDB(sportsmen, compId) {
    let ans = new Object()
    let trans;
    await dbUtils.beginTransaction()
        .then(async (newTransaction) => {
            trans = newTransaction;
            await Promise.all(await excelInsertSportsmanToCompetitonDB(trans, sportsmen, sportsmen[0], 0, compId))
                .then((result) => {
                    ans.status = Constants.statusCode.ok;
                    ans.results = Constants.msg.registerSuccess;
                    trans.commitTransaction();
                })
                .catch((error) => {
                    ans.status = Constants.statusCode.badRequest;
                    ans.results = err;
                    trans.rollbackTransaction();
                })
        })
        .fail(function (err) {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
            trans.rollbackTransaction();
        })

    return ans
}

async function excelDelSportsmenDB(sportsmem, compId) {
    let ans = new Object()
    let trans;
    await dbUtils.beginTransaction()
        .then(async (newTransaction) => {
            trans = newTransaction;
            await Promise.all(await deleteExcelSportsmanFromCompetitionDB(trans, sportsmem, sportsmem[0], 0, compId))
                .then((result) => {
                    ans.pass = true;
                    trans.commitTransaction();
                })
                .catch((error) => {
                    ans.pass = true;
                    ans.results = error;
                    trans.rollbackTransaction();
                })
        })
        .fail(function (err) {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
            trans.rollbackTransaction();
        });

    return ans

}

async function excelInsertSportsmanToCompetitonDB(trans, insertSportsman, sportsmanDetails, i, compId) {
    if (sportsmanDetails != undefined) {
        return trans.sql(`INSERT INTO competition_sportsman (idCompetition, idSportsman, category) Values (@compId,@id,@category)`)
            .parameter('compId', tediousTYPES.Int, compId)
            .parameter('id', tediousTYPES.Int, sportsmanDetails.id)
            .parameter('category', tediousTYPES.Int, sportsmanDetails.category)
            .execute()
            .then(async function (testResult) {
                if (i + 1 < insertSportsman.length) {
                    await excelInsertSportsmanToCompetitonDB(trans, insertSportsman, insertSportsman[i + 1], i + 1, compId)
                }
                return testResult
            })
    }
    return;
}

function deleteExcelSportsmanFromCompetitionDB(trans, sportsmem, sportsmenDetails, i, compId) {
    if (sportsmenDetails != undefined) {
        if (sportsmenDetails.id.length > 0) {
            return trans.sql(`DELETE FROM competition_sportsman WHERE idCompetition=@compId and idSportsman = @id ;`)
                .parameter('compId', tediousTYPES.Int, compId)
                .parameter('id', tediousTYPES.Int, sportsmenDetails.id)
                .execute()
                .then(async function (testResult) {
                    if (i + 1 < sportsmem.length) {
                        await deleteExcelSportsmanFromCompetitionDB(trans, sportsmem, sportsmem[i + 1], i + 1, compId);
                    }
                    return testResult
                });
        }
    }
    return;
}

function getIdsForDelete(data) {
    let delSportsman = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].length > 1)
            delSportsman.push({
                id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
            });
    }
    return delSportsman;
}

function cheackExcelData(data, categoryData) {
    let map = fixCategoryForCheck(categoryData);
    let ans = new Object();
    ans.results = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].length > 1) {
            if (data[i][Constants.colRegisterCompetitionExcel.category1] != undefined && data[i][Constants.colRegisterCompetitionExcel.category2] != undefined && data[i][Constants.colRegisterCompetitionExcel.category1].length > 0 && (data[i][Constants.colRegisterCompetitionExcel.category2].length > 0))
                if (data[i][Constants.colRegisterCompetitionExcel.category1] === (data[i][Constants.colRegisterCompetitionExcel.category2]))
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 1, ' + Constants.excelCompetitionEroorMsg.category + ' 2 ' + Constants.excelCompetitionEroorMsg.sameCategory
                    });
            if (data[i][Constants.colRegisterCompetitionExcel.category1] != undefined && data[i][Constants.colRegisterCompetitionExcel.category3] != undefined && data[i][Constants.colRegisterCompetitionExcel.category1].length > 0 && (data[i][Constants.colRegisterCompetitionExcel.category3].length > 0))
                if (data[i][Constants.colRegisterCompetitionExcel.category1] === (data[i][Constants.colRegisterCompetitionExcel.category3]))
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 1, ' + Constants.excelCompetitionEroorMsg.category + ' 3 ' + Constants.excelCompetitionEroorMsg.sameCategory
                    });
            if (data[i][Constants.colRegisterCompetitionExcel.category2] != undefined && data[i][Constants.colRegisterCompetitionExcel.category3] != undefined && data[i][Constants.colRegisterCompetitionExcel.category2].length > 0 && (data[i][Constants.colRegisterCompetitionExcel.category3].length > 0))
                if (data[i][Constants.colRegisterCompetitionExcel.category2] === (data[i][Constants.colRegisterCompetitionExcel.category3]))
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 2, ' + Constants.excelCompetitionEroorMsg.category + ' 3 ' + Constants.excelCompetitionEroorMsg.sameCategory
                    });

            if (data[i][Constants.colRegisterCompetitionExcel.category1] != undefined && data[i][Constants.colRegisterCompetitionExcel.category1].length > 0) {
                let idCategory = getIdFromCategroyString(data[i][Constants.colRegisterCompetitionExcel.category1]);
                if (data[i][Constants.colRegisterCompetitionExcel.sex] != map.get(idCategory).sex && map.get(idCategory).sex != 'מעורב')
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 1, ' + Constants.excelCompetitionEroorMsg.sexFail
                    });

                let age = parseInt(data[i][Constants.colRegisterCompetitionExcel.age]);
                let minAge = (parseInt(map.get(idCategory).minAge))
                let maxAge = (parseInt(map.get(idCategory).maxAge))

                if (age < minAge || age > maxAge) {
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 1, ' + Constants.excelCompetitionEroorMsg.ageFail
                    });
                }
            }
            if (data[i][Constants.colRegisterCompetitionExcel.category2] != undefined && data[i][Constants.colRegisterCompetitionExcel.category2].length > 0) {
                let idCategory = getIdFromCategroyString(data[i][Constants.colRegisterCompetitionExcel.category2]);
                if (data[i][Constants.colRegisterCompetitionExcel.sex] != map.get(idCategory).sex && map.get(idCategory).sex != 'מעורב')
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 2, ' + Constants.excelCompetitionEroorMsg.sexFail
                    });
                let age = parseInt(data[i][Constants.colRegisterCompetitionExcel.age]);
                let minAge = (parseInt(map.get(idCategory).minAge))
                let maxAge = (parseInt(map.get(idCategory).maxAge))
                if (age < minAge || age > maxAge) {
                    ans.results.push({
                        id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                        error: Constants.excelCompetitionEroorMsg.category + ' 2, ' + Constants.excelCompetitionEroorMsg.ageFail
                    });
                }
                if (data[i][Constants.colRegisterCompetitionExcel.category3] != undefined && data[i][Constants.colRegisterCompetitionExcel.category3].length > 0) {
                    let idCategory = getIdFromCategroyString(data[i][Constants.colRegisterCompetitionExcel.category3]);
                    if (data[i][Constants.colRegisterCompetitionExcel.sex] != map.get(idCategory).sex && map.get(idCategory).sex != 'מעורב')
                        ans.results.push({
                            id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                            error: Constants.excelCompetitionEroorMsg.category + ' 3, ' + Constants.excelCompetitionEroorMsg.sexFail
                        });
                    let age = parseInt(data[i][Constants.colRegisterCompetitionExcel.age]);
                    let minAge = (parseInt(map.get(idCategory).minAge))
                    let maxAge = (parseInt(map.get(idCategory).maxAge))
                    if (age < minAge || age > maxAge) {
                        ans.results.push({
                            id: data[i][Constants.colRegisterCompetitionExcel.idSportsman],
                            error: Constants.excelCompetitionEroorMsg.category + ' 3, ' + Constants.excelCompetitionEroorMsg.ageFail
                        });
                    }
                }
            }
        }
    }
            if (ans.results.length > 0)
                ans.pass = false;
            else
                ans.pass = true;
            return ans
}


    function getIdFromCategroyString(line) {
        line = line.split(" ")[line.split(" ").length - 1];
        line = line.substring(0, line.length - 1);
        return parseInt(line)
    }

    function fixCategoryForCheck(data) {
        let categoryMap = new Map();
        for (let i = 0; i < data.length; i++)
            categoryMap.set(data[i].id, {
                minAge: data[i].minAge,
                maxAge: data[i].maxAge ? data[i].maxAge : 100,
                sex: data[i].sex
            });

        return categoryMap;

    }

    module.exports.cheackExcelData = cheackExcelData;
    module.exports.getIdsForDelete = getIdsForDelete;
    module.exports.excelDelSportsmenDB = excelDelSportsmenDB;
    module.exports.regExcelSportsmenCompDB = regExcelSportsmenCompDB;
    module.exports.fixCategoryExcelData = fixCategoryExcelData;
    module.exports.getDetail = getDetails;
    module.exports.registerSportsmenToCompetition = registerSportsmenToCompetition;
    module.exports.reRangeCompetitionSportsman = reRangeCompetitionSportsman;
