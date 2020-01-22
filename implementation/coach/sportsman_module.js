const common_sportsman_module = require('../common/sportsman_module');

function initQuery(queryData, id) {
    let conditions = common_sportsman_module.buildConditions_forGetSportsmen(queryData, id);
    let orderby = common_sportsman_module.buildOrderBy_forGetSportsmen(queryData);
    let query = buildQuery_forGetSportsman(queryData, orderby);
    query.query += conditions.conditionStatement;
    query.queryCount += conditions.conditionStatement;
    query.query += `) tmp` + (query.additionalData ? ` ${query.additionalData}` : '') + (conditions.limits ? conditions.limits : '');
    return query;
}

/**
 * getting list of sportsmen from the DB according the query data
 * @param queryData - filters to filter the result set
 * @param idCoach - whose sportsmen to return
 * @return the following json {status, results}
 */
async function getSportsmen(queryData, idCoach) {
    let ans = new Object();
    let query = initQuery(queryData, idCoach);
    await dbUtils.sql(query.query)
        .parameter('idCoach', tediousTYPES.Int, idCoach)
        .parameter('value', tediousTYPES.NVarChar, queryData.value)
        .parameter('sportStyle', tediousTYPES.NVarChar, queryData.sportStyle)
        .parameter('club', tediousTYPES.NVarChar, queryData.club)
        .parameter('sex', tediousTYPES.NVarChar, queryData.sex)
        .parameter('compId', tediousTYPES.Int, queryData.competition)
        .parameter('startIndex', tediousTYPES.NVarChar, queryData.startIndex)
        .parameter('endIndex', tediousTYPES.NVarChar, queryData.endIndex)
        .execute()
        .then(result => {
            ans.results = {
                sportsmen: result
            };
            ans.status = Constants.statusCode.ok;
        })
        .fail((err) => {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
        });
    return ans
}

/**
 * getting the number of sportsmen exists according to the query data
 * @param queryData - filters to filter the result set
 * @param idCoach - whose sportsmen to retrieve
 * @return {status, results}
 */
async function getSportsmenCount(queryData, idCoach) {
    let ans = new Object();
    let query = initQuery(queryData, idCoach);

    await dbUtils.sql(query.queryCount)
        .parameter('idCoach', tediousTYPES.Int, idCoach)
        .parameter('value', tediousTYPES.NVarChar, queryData.value)
        .parameter('sportStyle', tediousTYPES.NVarChar, queryData.sportStyle)
        .parameter('club', tediousTYPES.NVarChar, queryData.club)
        .parameter('sex', tediousTYPES.NVarChar, queryData.sex)
        .parameter('compId', tediousTYPES.Int, queryData.competition)
        .execute()
        .then(result => {
            ans.results = result[0];
            ans.status = Constants.statusCode.ok;
        })
        .fail((err) => {
            ans.status = Constants.statusCode.badRequest;
            ans.results = err;
        });
    return ans;
}

function buildQuery_forGetSportsman(queryData, orderBy) {
    let query = new Object();
    query.query = `select * from (select ROW_NUMBER() OVER (${orderBy}) AS rowNum, `;
    if (queryData.sportStyle !== undefined) {
        query.query += `user_Sportsman.id,firstname,lastname,photo
                    from user_Sportsman
                    join sportsman_sportStyle
                    on user_Sportsman.id = sportsman_sportStyle.id
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman`;
        query.queryCount = `Select count(*) as count
                    from user_Sportsman
                    join sportsman_sportStyle
                    on user_Sportsman.id = sportsman_sportStyle.id
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman`;
    } else if (queryData.competition !== undefined ) {
        if(queryData.competitionOperator == undefined){
            query.query = `select id, firstname, lastname, photo, category, sex, FLOOR(DATEDIFF(DAY, birthdate, getdate()) / 365.25) as age, sportclub from(
                            Select ROW_NUMBER() OVER ( order by firstname, id) AS rowNum, *
                        from user_Sportsman
                        join sportsman_coach
                        on user_Sportsman.id = sportsman_coach.idSportman`;
            query.additionalData = `left join competition_sportsman
                    on tmp.id = competition_sportsman.idSportsman and idCompetition = @compId`;
            query.queryCount = `select count(*) as count from
                    (Select user_Sportsman.id, firstname, lastname, photo, sportsman_coach.idCoach
                        from user_Sportsman
                        join sportsman_coach
                        on user_Sportsman.id = sportsman_coach.idSportman
                        where idCoach = @idCoach) as sportsman_coach`;
        }
        else if (queryData.competitionOperator == '==') {
            query.query += `id, firstname, lastname, photo from
                    (Select user_Sportsman.id, firstname, lastname, photo, sportsman_coach.idCoach
                        from user_Sportsman
                        join sportsman_coach
                        on user_Sportsman.id = sportsman_coach.idSportman
                        where sportsman_coach.idCoach = @idCoach) as sportsman_coach
                    join competition_sportsman
                    on sportsman_coach.id = competition_sportsman.idSportsman`;
            query.queryCount = `select count(*) as count from
                    (Select user_Sportsman.id, firstname, lastname, photo, sportsman_coach.idCoach
                        from user_Sportsman
                        join sportsman_coach
                        on user_Sportsman.id = sportsman_coach.idSportman
                        where idCoach = @idCoach) as sportsman_coach
                    join competition_sportsman
                    on sportsman_coach.id = competition_sportsman.idSportsman`;
        } else if (queryData.competitionOperator == '!=') {
            query.query += `id, firstname, lastname, photo, sportclub from
                (Select user_Sportsman.id, firstname, lastname, photo, sportclub
                    from user_Sportsman
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman
                    where idCoach = @idCoach
                except
                select id, firstname, lastname,photo, sportclub from
                (Select user_Sportsman.id, firstname, lastname, photo, sportsman_coach.idCoach, sportclub
                    from user_Sportsman
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman
                    where sportsman_coach.idCoach = @idCoach) as sportsman_coach
                    join competition_sportsman
                    on sportsman_coach.id = competition_sportsman.idSportsman
                    where idCompetition = @compId) as t`;
            query.queryCount = `Select count(*) as count from
                (Select user_Sportsman.id, firstname, lastname, photo
                    from user_Sportsman
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman
                    where idCoach = @idCoach
                except
                select id, firstname, lastname,photo from
                (Select user_Sportsman.id, firstname, lastname, photo, sportsman_coach.idCoach
                    from user_Sportsman
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman
                    where sportsman_coach.idCoach = @idCoach) as sportsman_coach
                    join competition_sportsman
                    on sportsman_coach.id = competition_sportsman.idSportsman
                    where idCompetition = @compId) as t`;
        }
    } else {
        query.query += `id,firstname,lastname,photo
                    from user_Sportsman
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman`;
        query.queryCount = `Select count(*) as count
                    from user_Sportsman
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman`;
    }
    return query;
}

module.exports.getSportsmen = getSportsmen;
module.exports.getSportsmenCount = getSportsmenCount;
