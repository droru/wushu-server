function getCoaches(req, res) {
    DButilsAzure.execQuery(` Select Id,firstname,lastname from user_Coach`)
        .then((result) => {
            res.status(200).send(result)
        })
        .catch((eror) => {
            res.status(400).send(eror)
        })
}

module.exports._getCoaches = getCoaches;
