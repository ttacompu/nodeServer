const http = require('http');
const fs = require('fs');
const url = require('url');

function make_error(err, msg){
    var e = new Error(msg);
    e.code = err;
    return e;
}

function send_failure(res, server_code, err){
    var code = (err.code) ? err.code : err.name;
    res.writeHead(server_code, {"Content-Type" : "application/json"});
    res.end(JSON.stringify({error : code, message : err.message}) + "\n");
}

function send_success(res, data){
    res.writeHead(200, {"Content-Type" : "application/json"});
    var output = {error : null, data : data};
    res.end(JSON.stringify(output) + "\n");

}

function invalid_resource(){
    return make_error("invalid_resource", "the requested resource does not exist.")
}

function no_such_album(){
    return make_error("no_such_album", "The specified album does not exist")
}

function load_album_list(callback) {
    fs.readdir("albums", (err, files) => {
        if (err) {
            callback(make_error("file_error", JSON.stringify(err)))
            return;
        }
        const folderOnly = [];

        const iterator = (index) =>{
            if(index == files.length){
                callback(null, folderOnly);
                return;
            }

           fs.stat("albums/" + files[index], (err, stats )=>{
               if(err){
                   callback(make_error("file_error",JSON.stringify(err)));
                   return;
               }

               if(stats.isDirectory()){
                   var obj = {name : files[index]};
                   folderOnly.push(obj);
               }

               iterator(index+1);

           }) 

        }

        iterator(0);
    });
}

function handle_list_albums(req, res){
    load_album_list((err, albums)=>{
        if(err){
            send_failure(res, 500, err);
            return;
        }
        send_success(res, {albums : albums});

    })
}

function load_album(album_name, callback){
    fs.readdir("albums/"+ album_name, (err, files)=>{
        if(err){
            if(err.code == "ENOENT"){
                callback(no_such_album())
            }else{
                callback(make_error("file_error", JSON.stringify(err)))
            }
            return;
        }

        var only_files =[];
        var path = `albums/${album_name}/`;

        const iterator = (index) =>{
            if(index == files.length){
                var obj = {short_name : album_name, phtos : only_files};
                callback(null, obj);
                return;
            }

           fs.stat(path + files[index], (err, stats )=>{
               if(err){
                   callback(make_error("file_error",JSON.stringify(err)));
                   return;
               }

               if(stats.isFile()){
                   var obj = {filename : files[index], desc : files[index]};
                   only_files.push(obj);
               }
               iterator(index+1);
           }) 
        }
        iterator(0);
    })
}

function handle_get_album(req, res){
    var album_name = req.url.substr(7, req.url.length - 12);
    load_album(album_name, (err, album_contents) =>{
        if(err && err.code == "no_such_album"){
                send_failure(res, 404, err);
        }
        else if (err){
            send_failure(res, 500, err);
        }else{
            send_success(res, {album_data : album_contents})
        }

    } )
}

function handle_incoming_request(req, res) {
    console.log(`INCOMING REQUEST : ${req.method} ${req.url} `);

    req.parsed_url = url.parse(req.url, true);
    var core_url = req.parsed_url.pathname;

    if(core_url  == '/albums.json'){
        handle_list_albums(req, res);
    }
    else if(core_url.substr(0, 7) == '/albums' && core_url .substr(req.url.length-5)== '.json'){
        handle_get_album(req, res);
    }else{
        send_failure(res, 404, invalid_resource());
    }

}

http.createServer(handle_incoming_request).listen(8080);
console.log('Server running at 8080');