let token = null;

function setToken(t) {
    token = t;
}

function getToken() {
    return token;
}

module.exports = {
    setToken,
    getToken,
};