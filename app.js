/**
 * Created by manoj.kumar on 12-12-2016.
 */

var app = require('express')();
var responseTime = require('response-time');
var axios = require('axios');
var redis = require('redis');


var client = redis.createClient();

client.on('error',function(err){
    console.log('Error '+ err);
})


app.set('port', (process.env.PORT || 4000));

app.use(responseTime());

app.get('/stars/:username', function(req, res){
    var username = req.params.username;

    // use the redis client to get the total number of stars associated to that
    // username from our redis cache
    client.get(username, function(error, result) {

        if (result) {
            // the result exists in our cache - return it to our user immediately
            res.send({ "totalStars": result, "source": "redis cache" });
        } else {
            // we couldn't find the key "coligo-io" in our cache, so get it
            // from the GitHub API
            getUserRepositories(username)
                .then(computeTotalStars)
                .then(function(totalStars) {
                    // store the key-value pair (username:totalStars) in our cache
                    // with an expiry of 1 minute (60s)
                    client.setex(username, 60, totalStars);
                    // return the result to the user
                    res.send({ "totalStars": totalStars, "source": "GitHub API", 'addedBy' : 'manoj' });
                }).catch(function(response) {
                    if (response.status === 404){
                        res.send('The GitHub username could not be found. Try "coligo-io" as an example!');
                    } else {
                        res.send(response);
                    }
                });
        }

    });
});


app.get('/repo/:username', function(req,res){
    var username = req.params.username;
    console.log(username);
    client.get('repo'+username, function(err, result){
        if(result){
            res.send(result);
        }else{
            getRepositories(username).then(getRepo).then(function(resu){
                console.log('repo' + resu);
                //res.send( );
                var data = getRepoName(resu.data)
                client.setex('repo'+username, 60, data);
                res.send(data);
            })
        }
    });
});

app.listen(app.get('port'), function(){
    console.log('Server listening on port:', app.get('port'));
});

function getRepoName(data){
    var names = [];
     data.forEach(function(element){
        names.push(element.name);
    });
    console.log(names);
    return names;
}

function getRepositories(user){
    var githubEndpoint = 'https://api.github.com/users/' + user + '/repos' + '?per_page=100';
    return axios.get(githubEndpoint);
}

function getUserRepositories(user) {
    var githubEndpoint = 'https://api.github.com/users/' + user + '/repos' + '?per_page=100';
    return axios.get(githubEndpoint);
}


function getRepo(repo){
    return repo;
}

// add up all the stars and return the total number of stars across all repositories
function computeTotalStars(repositories) {
    return repositories.data.reduce(function(prev, curr) {
        return prev + curr.stargazers_count
    }, 0);
}