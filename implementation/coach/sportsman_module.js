const common_sportsman_module = require('../common/sportsman_module');

function initQury(queryData, id) {
    let conditions = common_sportsman_module.buildConditions_forGetSportsmen(queryData, id);
    let query = buildQuery_forGetSportsman(queryData);
    query.query += conditions;
    query.queryCount += conditions;
    query.query += common_sportsman_module.buildOrderBy_forGetSportsmen(queryData);
    return query;
}

async function getSportsmen(queryData, id) {
    let ans = new Object();
    let query = initQury(queryData, id);

    await Promise.all([dbUtils.sql(query.query)
        .parameter('idCoach', tediousTYPES.Int, queryData.idCoach)
        .parameter('value', tediousTYPES.NVarChar, queryData.value)
        .parameter('sportStyle', tediousTYPES.NVarChar, queryData.sportStyle)
        .parameter('club', tediousTYPES.NVarChar, queryData.club)
        .parameter('sex', tediousTYPES.NVarChar, queryData.sex)
        .parameter('compId', tediousTYPES.Int, queryData.competition)
        .execute()
        .fail((err) => {
            ans.status = Constants.statusCode.badRequest;
            ans.results = error;
        }),
        dbUtils.sql(query.queryCount)
            .parameter('idCoach', tediousTYPES.Int, queryData.idCoach)
            .parameter('value', tediousTYPES.NVarChar, queryData.value)
            .parameter('sportStyle', tediousTYPES.NVarChar, queryData.sportStyle)
            .parameter('club', tediousTYPES.NVarChar, queryData.club)
            .parameter('sex', tediousTYPES.NVarChar, queryData.sex)
            .parameter('compId', tediousTYPES.Int, queryData.competition)
            .execute()
            .fail((err) => {
                ans.status = Constants.statusCode.badRequest;
                ans.results = error;
            }),
    ])
        .then(result => {
            ans.results = {
                sportsmen: result[0],
                totalCount: result[1][0].count
            };
            ans.status = Constants.statusCode.ok;
        })
        .catch((error) => {
            ans.status = Constants.statusCode.badRequest;
            ans.results = error;
        });
    return ans
}

function buildQuery_forGetSportsman(queryData) {
    let query = new Object();
    if (queryData.sportStyle !== undefined) {
        query.query = `Select user_Sportsman.id,firstname,lastname,photo
                    from user_Sportsman
                    join sportsman_category
                    on user_Sportsman.id = sportsman_category.id
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman`;
        query.queryCount = `Select count(*) as count
                    from user_Sportsman
                    join sportsman_category
                    on user_Sportsman.id = sportsman_category.id
                    join sportsman_coach
                    on user_Sportsman.id = sportsman_coach.idSportman`;
    } else if (queryData.competition !== undefined && queryData.competitionOperator !== undefined) {
        if (queryData.competitionOperator == '==') {
            query.query = `select id, firstname, lastname, photo from
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
            query.query = `Select id, firstname, lastname, photo, sportclub from
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
                    where idCompetition = @reqQueryCompetition) as t`;
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
                    where idCompetition = @reqQueryCompetition) as t`;
        }
    } else {
        query.query = `Select id,firstname,lastname,photo
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