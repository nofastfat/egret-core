/**
 * Created by huanghaiying on 14/11/9.
 */

var path = require("path");
var plist = require('../core/plist');
var file = require("../core/file");
var fs = require("fs");
var image = require("../core/image");

function run(currDir, args, opts) {
    if (args[0]) {
        currDir = path.resolve(args[0]);
    }
    linkChildren(currDir);
}

var currentFileUrl = "";
function linkChildren(fileUrl) {
    if (file.isDirectory(fileUrl)) {
        var fileList = file.getDirectoryListing(fileUrl, true);

        for (var key in fileList) {
            var fileName = fileList[key];

            var tempFileUrl = path.join(fileUrl, fileName);
            linkChildren(tempFileUrl);
        }
        return;
    }

    try {
        var stuStr = file.read(fileUrl);
        var stuData = JSON.parse(stuStr);

        if (stuData["armature_data"] == null || stuData["animation_data"] == null) {
            return;
        }
    }
    catch (e) {

        return;
    }
    currentFileUrl = fileUrl;
    var fileName = file.getFileName(fileUrl);
    var dbData = {"armature":[], "version":2.3, "name" : fileName, "frameRate":60};

    for (var i = 0; i < stuData["animation_data"].length; i++) {
        var stuAnimation = stuData["animation_data"][i];
        var stuArmature = stuData["armature_data"][i];

        var dbArmature = {"bone":[], "skin":[], "animation":[]};
        dbData["armature"].push(dbArmature);

        //设置name
        dbArmature["name"] = stuArmature["name"];

        //设置bone
        setBone(dbArmature["bone"], stuArmature["bone_data"]);

        //设置skin
        var skin = {"name" : 0, "slot" : []};
        dbArmature["skin"].push(skin);
        setSlot(skin["slot"], stuArmature["bone_data"]);

        //设置动画
        setAnimation(dbArmature["animation"], stuAnimation["mov_data"]);
    }

    removeMatrix(dbData);

    file.save(fileUrl.replace(".json", "_ske.json"), JSON.stringify(dbData, null, "\t"));

    moveResources(fileUrl, stuData["texture_data"]);
}

function removeMatrix(data) {
    for (var key in data) {
        if (key == "matrix") {
            delete data[key];
        }
        else if (data[key] instanceof Object) {
            removeMatrix(data[key]);
        }
    }
}

function moveResources(fileUrl, resources) {
    var fileName = file.getFileName(fileUrl);
    var filePath = fileUrl.substring(0, fileUrl.lastIndexOf(fileName));

    for (var i = 0; i < resources.length; i++) {
        var name = resources[i]["name"];

        file.copy(path.join(filePath, "..", "Resources", name + ".png"), path.join(filePath, fileName, name + ".png"));
    }
}

var layersInfo = {};
function setLayer(name, parent) {
    if (layersInfo[name] == null) {
        layersInfo[name] = [];
    }

    if (parent != null && parent != "") {
        if (layersInfo[parent] == null) {
            layersInfo[parent] = [];
        }

        layersInfo[parent].push(name);
    }
}

var resultArr = [];
function resortLayers() {
    var tempArr = [];
    for (var name in layersInfo) {
        tempArr.push({"name" : name, "children" : layersInfo[name].concat([])});
    }

    while (tempArr.length > 0) {
        for (var i = tempArr.length - 1; i >= 0; i--) {
            var info = tempArr[i];
            if (info["children"].length == 0) {
                resultArr.push(info["name"]);

                tempArr.splice(i, 1);

                for (var j = 0; j < tempArr.length; j++) {
                    var temp = tempArr[j];
                    if (temp["children"].indexOf(info["name"]) >= 0) {
                        var idx = temp["children"].indexOf(info["name"]);
                        temp["children"].splice(idx, 1);
                    }
                }
            }
        }
    }

    resultArr.reverse();
}

function radianToAngle(radian) {
    return radian * 180 / Math.PI;
}


var bones = {};
function setBone(dbBones, stuBones) {

    var maxIdx = 0;
    //层级父子数组
    for (var i = 0; i < stuBones.length; i++) {
        var stuBone = stuBones[i];

        var dbBone = {"transform":{}};
        //dbBones.push(dbBone);
        dbBones[stuBone["z"]] = dbBone;
        maxIdx = Math.max(maxIdx, stuBone["z"]);
        dbBone["name"] = stuBone["name"];
        //dbBone["z"] = stuBone["z"];

        if (stuBone["parent"] != null && stuBone["parent"] != "") {
            dbBone["parent"] = stuBone["parent"];
        }

        setLayer(stuBone["name"], stuBone["parent"]);

        dbBone["transform"]["x"] = stuBone["x"];
        dbBone["transform"]["y"] = -stuBone["y"];
        dbBone["transform"]["skX"] = radianToAngle(stuBone["kX"]);
        dbBone["transform"]["skY"] = -radianToAngle(stuBone["kY"]);
        dbBone["transform"]["scX"] = stuBone["cX"];
        dbBone["transform"]["scY"] = stuBone["cY"];

        dbBone["matrix"] = [dbBone["transform"]["x"], dbBone["transform"]["y"],
            dbBone["transform"]["scX"], dbBone["transform"]["scY"],
            0, dbBone["transform"]["skX"], dbBone["transform"]["skY"], 0, 0];

        bones[stuBone["name"]] = dbBone;
    }

    for (var i = 0, count = 0; count <= maxIdx; i++, count++) {
        if (dbBones[i] == null) {
            dbBones.splice(i, 1);
            i--;
            continue;
        }
        dbBones[i]["z"] = i;
    }

    resortLayers();

    for (var i = 0; i < resultArr.length; i++) {
        var nodeName = resultArr[i];

        var bone = bones[nodeName];
        if (bone["parent"] == null) {
            continue;
        }

        var parentBone = bones[bone["parent"]];

        var matrix = new Matrix();
        var o = bone;
        while (o != null) {
            var temp = o["matrix"];
            matrix.prependTransform(temp[0], temp[1], temp[2], temp[3], temp[4], temp[5], temp[6], 0, 0);

            if (o["parent"] != null) {
                o = bones[o["parent"]];
            }
            else {
                break;
            }
        }
        matrix.append(1, 0, 0, 1, 0, 0);

        bone["transform"]["x"] = matrix["tx"];
        bone["transform"]["y"] = matrix["ty"];
        bone["transform"]["scX"] *= parentBone["transform"]["scX"];
        bone["transform"]["scY"] *= parentBone["transform"]["scY"];
        bone["transform"]["skX"] += parentBone["transform"]["skX"];
        bone["transform"]["skY"] += parentBone["transform"]["skY"];
    }
}

function setSlot(dbSlots, stuSlots) {
    var maxIdx = 0;
    for (var i = 0; i < stuSlots.length; i++) {
        var stuSlot = stuSlots[i];

        var dbSlot = {};
        dbSlots[bones[stuSlot["name"]]["z"]] = dbSlot;
        maxIdx = Math.max(maxIdx, bones[stuSlot["name"]]["z"]);

        dbSlot["blendMode"] = "normal";
        dbSlot["z"] = bones[stuSlot["name"]]["z"];
        dbSlot["name"] = stuSlot["name"];
        dbSlot["parent"] = stuSlot["name"];

        dbSlot["display"] = [];

        setDisplay(dbSlot["display"], stuSlot["display_data"]);
    }

    for (var i = 0, count = 0; count <= maxIdx; i++, count++) {
        if (dbSlots[i] == null) {
            dbSlots.splice(i, 1);
            i--;
            continue;
        }
        dbSlots[i]["z"] = i;
    }
}

function setDisplay(dbDisplays, stuDisplays) {
    for (var i = 0; i < stuDisplays.length; i++) {
        var stuDisplay = stuDisplays[i];

        var dbDisplay = {"transform":{}};
        dbDisplays.push(dbDisplay);


        var fileName = file.getFileName(currentFileUrl);
        var currentPath = currentFileUrl.substring(0, currentFileUrl.lastIndexOf(fileName));
        var picUrl = path.join(currentPath, "..", "Resources", stuDisplay["name"]);
        var fileData = fs.readFileSync(picUrl);
        var info = image.getInfo(fileData);

        dbDisplay["name"] = stuDisplay["name"].replace(/(\.png)|(\.jpg)/, "");
        dbDisplay["type"] = stuDisplay["displayType"] == 0 ? "image" : "image";
        dbDisplay["transform"]["x"] = stuDisplay["skin_data"][0]["x"];
        dbDisplay["transform"]["y"] = -stuDisplay["skin_data"][0]["y"];
        dbDisplay["transform"]["pX"] = info.width / 2;
        dbDisplay["transform"]["pY"] = info.height / 2;
        dbDisplay["transform"]["skX"] = radianToAngle(stuDisplay["skin_data"][0]["kX"]);
        dbDisplay["transform"]["skY"] = -radianToAngle(stuDisplay["skin_data"][0]["kY"]);
        dbDisplay["transform"]["scX"] = stuDisplay["skin_data"][0]["cX"];
        dbDisplay["transform"]["scY"] = stuDisplay["skin_data"][0]["cY"];
    }
}

function setAnimation(dbAnimations, stuAnimations) {
    for (var i = 0; i < stuAnimations.length; i++) {
        var stuAnimation = stuAnimations[i];

        var dbAnimation = {};
        dbAnimations.push(dbAnimation);

        dbAnimation["scale"] = 1;
        dbAnimation["duration"] = stuAnimation["dr"];
        dbAnimation["name"] = stuAnimation["name"];
        dbAnimation["fadeInTime"] = 0;
        dbAnimation["tweenEasing"] = stuAnimation["twE"];
        dbAnimation["loop"] = stuAnimation["lp"] == true ? 0 : 1;

        dbAnimation["timeline"] = [];
        setTimeline(dbAnimation["timeline"], stuAnimation["mov_bone_data"]);
    }
}

var timelines = {};
var count = 0;
function setTimeline(dbTimelines, stuTimelines) {
    count++;

    timelines = {};
    var maxIdx = 0;
    for (var i = 0; i < stuTimelines.length; i++) {
        var stuTimeline = stuTimelines[i];

        var dbTimeline = {};
        dbTimeline["name"] = stuTimeline["name"];
        dbTimelines[bones[stuTimeline["name"]]["z"]] = dbTimeline;
        maxIdx = Math.max(maxIdx, bones[stuTimeline["name"]]["z"]);
        dbTimeline["offset"] = 0;
        dbTimeline["scale"] = 1;

        dbTimeline["frame"] = [];

        timelines[dbTimeline["name"]] = dbTimeline;

        setFrame(dbTimeline["frame"], stuTimeline["frame_data"], bones[dbTimeline["name"]], i);
    }

    //设置层级
    for (var i = 0, count = 0; count <= maxIdx; i++, count++) {
        if (dbTimelines[i] == null) {
            dbTimelines.splice(i, 1);
            i--;
            continue;
        }
        var frames = dbTimelines[i]["frame"];
        for (var k = 0; k < frames.length; k++) {
            frames[k]["z"] = i;
        }
    }

    //从子往外加帧
    for (var i = 0; i < resultArr.length; i++) {
        var childName = resultArr[resultArr.length - 1 - i];
        if (timelines[childName] == null) {
            continue;
        }

        if (bones[childName]["parent"]) {//存在父节点
            if (timelines[bones[childName]["parent"]] == null) {
                continue;
            }

            var pFrames = timelines[bones[childName]["parent"]]["frame"];
            var cFrames = timelines[childName]["frame"];

            var tempFrameId = 0;
            for (var j = 0; j < cFrames.length; j++) {
                var cFrame = cFrames[j];
                addFrame(pFrames, tempFrameId);
                tempFrameId += cFrame["duration"];
            }
        }
    }

    //从父往外加帧
    for (var i = 0; i < resultArr.length; i++) {
        var pName = resultArr[i];
        var children = layersInfo[pName];
        var tempFrameId = 0;
        if (timelines[pName] == null) {
            continue;
        }

        var pFrames = timelines[pName]["frame"];
        for (var j = 0; j < pFrames.length; j++) {
            var pFrame = pFrames[j];
            for (var k = 0; k < children.length; k++) {
                if (timelines[children[k]] == null) {
                    continue;
                }
                var cFrames = timelines[children[k]]["frame"];
                addFrame(cFrames, tempFrameId);
            }
            tempFrameId += pFrame["duration"];
        }
    }

    //
    for (var i = 0; i < resultArr.length; i++) {
        var name = resultArr[i];
        var bone = bones[name];

            var timeline = timelines[name];
            if (timeline == null) {
                continue;
            }
            var frameId = 0;

            for (var j = 0; j < timeline["frame"].length; j++) {
                var tempFrame = timeline["frame"][j];

                if (tempFrame["displayIndex"] != -1) {
                    var matrix = new Matrix();
                    var o = tempFrame;
                    var tempName = name;
                    while (o != null) {
                        var temp = o["matrix"];
                        matrix.prependTransform(temp[0], temp[1], temp[2], temp[3], temp[4], temp[5], temp[6], 0, 0);

                        if (bones[tempName]["parent"] != null) {
                            o = getParentFrame(bones[tempName]["parent"], frameId);
                            tempName = bones[tempName]["parent"];
                        }
                        else {
                            break;
                        }
                    }
                    matrix.append(1, 0, 0, 1, 0, 0);
                    tempFrame["transform"]["x"] = matrix["tx"];
                    tempFrame["transform"]["y"] = matrix["ty"];
                    tempFrame["transform"]["pX"] = 0.5;
                    tempFrame["transform"]["pY"] = 0.5;

                    if (bone["parent"] == null) {
                        tempFrame["transform"]["scX"] = tempFrame["matrix"][2];
                        tempFrame["transform"]["scY"] = tempFrame["matrix"][3];
                        tempFrame["transform"]["skX"] = tempFrame["matrix"][5];
                        tempFrame["transform"]["skY"] = tempFrame["matrix"][6];
                    }
                    else {
                        var dbParentFrame = getParentFrame(bone["parent"], frameId);

                        tempFrame["transform"]["scX"] = tempFrame["matrix"][2] * dbParentFrame["transform"]["scX"];
                        tempFrame["transform"]["scY"] = tempFrame["matrix"][3] * dbParentFrame["transform"]["scY"];
                        tempFrame["transform"]["skX"] = tempFrame["matrix"][5] + dbParentFrame["transform"]["skX"];
                        tempFrame["transform"]["skY"] = tempFrame["matrix"][6] + dbParentFrame["transform"]["skY"];
                    }
                }

                frameId += tempFrame["duration"];
            }
    }

}

function addFrame(frames, frameId) {
    var tempFrameId = 0;
    for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        if (tempFrameId == frameId) {
            return;
        }
        else if (tempFrameId < frameId) {
            tempFrameId += frame["duration"];
            continue;
        }

        var lastFrame = frames[i - 1];
        var nextFrame = frames[i];
        var midFrame = clone(lastFrame, {});

        var lastDu = frameId - (tempFrameId - lastFrame["duration"]);
        var midDu = lastFrame["duration"] - lastDu;
        lastFrame["duration"] = lastDu;
        midFrame["duration"] = midDu;
        delete midFrame["event"];

        var per = lastDu / (lastDu + midDu);
        if (lastFrame["colorTransform"] || nextFrame["colorTransform"]) {
            midFrame["colorTransform"] = {};

            midFrame["colorTransform"]["a0"] = getProperty(lastDu, nextFrame, ["colorTransform", "a0"], 255, per);
            midFrame["colorTransform"]["r0"] = getProperty(lastDu, nextFrame, ["colorTransform", "r0"], 255, per);
            midFrame["colorTransform"]["g0"] = getProperty(lastDu, nextFrame, ["colorTransform", "g0"], 255, per);
            midFrame["colorTransform"]["b0"] = getProperty(lastDu, nextFrame, ["colorTransform", "b0"], 255, per);
            midFrame["colorTransform"]["aM"] = 0;
            midFrame["colorTransform"]["rM"] = 0;
            midFrame["colorTransform"]["gM"] = 0;
            midFrame["colorTransform"]["bM"] = 0;
        }

        midFrame["matrix"] = getMatrix(lastFrame["matrix"], nextFrame["matrix"], per);

        frames.splice(i, 0, midFrame);
        return;
    }

    var lastFrame = frames[frames.length - 1];
    var midFrame = clone(lastFrame, {});
    lastFrame["duration"] = frameId - (tempFrameId - 1);
    delete midFrame["event"];

    frames.push(midFrame);
}

function getMatrix(array1, array2, per) {
    var array = [];
    for (var i = 0; i < array1.length; i++) {
        array.push(array1[i] + (array2[i] - array1[i]) * per);
    }
    return array;
}

function getProperty(last, next, keys, devalue, per) {
    var lastObj = last;
    for (var i = 0; i < keys.length; i++) {
        if (lastObj[keys[i]] == null) {
            lastObj = devalue;
            break;
        }
        lastObj = lastObj[keys[i]];
    }

    var nextObj = next;
    for (var i = 0; i < keys.length; i++) {
        if (nextObj[keys[i]] == null) {
            nextObj = devalue;
            break;
        }
        nextObj = nextObj[keys[i]];
    }

    return lastObj + (nextObj - lastObj) * per;
}

function clone(frame, result) {
    for (var key in frame) {
        if (frame[key] instanceof Array) {
            result[key] = clone(frame[key], []);
        }
        else if (frame[key] instanceof Object) {//
            result[key] = clone(frame[key], {});
        }
        else {
            result[key] = frame[key];
        }
    }
    return result;
}

function getParentFrame(parent, frameId) {
    var timeline = timelines[parent];

    var tempFrameId = 0;
    for (var i = 0; i < timeline["frame"].length; i++) {
        if (tempFrameId >= frameId) {
            return timeline["frame"][i];
        }
        tempFrameId += timeline["frame"][i]["duration"];
    }

    return {};
}

function setFrame(dbFrames, stuFrames, bone, z) {

    for (var i = 0; i < stuFrames.length; i++) {
        var stuFrame = stuFrames[i];
        var dbFrame = {};

        if (i == 0) {
            var startIdx = stuFrame["fi"];

            if (startIdx != 0) {
                var temp = {"duration" : startIdx, "displayIndex" : -1};
                dbFrames.push(temp);
            }
        }

        if (stuFrame["dI"] > 0) {
            dbFrame["displayIndex"] = stuFrame["dI"];
        }
        else if (stuFrame["dI"] == -1000) {
            dbFrame["hide"] = 1;
        }

        dbFrames.push(dbFrame);
        if (i < stuFrames.length - 1) {
            var nextFrame = stuFrames[i + 1];
            dbFrame["duration"] = nextFrame["fi"] - stuFrame["fi"];
        }
        else {
            dbFrame["duration"] = 1;
        }

        if (stuFrame["evt"]) {
            dbFrame["event"] = stuFrame["evt"];
        }


        dbFrame["z"] = z;//stuFrame["z"];
        dbFrame["tweenEasing"] = stuFrame["twE"];

            if (stuFrame["color"]) {
                dbFrame["colorTransform"] = {};
                dbFrame["colorTransform"]["a0"] = stuFrame["color"]["a"];
                dbFrame["colorTransform"]["r0"] = stuFrame["color"]["r"];
                dbFrame["colorTransform"]["g0"] = stuFrame["color"]["g"];
                dbFrame["colorTransform"]["b0"] = stuFrame["color"]["b"];
                dbFrame["colorTransform"]["aM"] = 0;
                dbFrame["colorTransform"]["rM"] = 0;
                dbFrame["colorTransform"]["gM"] = 0;
                dbFrame["colorTransform"]["bM"] = 0;
            }

        dbFrame["transform"] = {};

        var matrix = bone["matrix"];
        dbFrame["matrix"] = [stuFrame["x"] + matrix[0],
                             -stuFrame["y"] + matrix[1],
                stuFrame["cX"] * matrix[2],
                stuFrame["cY"] * matrix[3],
                             0,
                radianToAngle(stuFrame["kX"]) + matrix[5],
                -radianToAngle(stuFrame["kY"]) + matrix[6], 0, 0];

    }
}


var Matrix = function(){
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.tx = 0;
    this.ty = 0;
}
Matrix.DEG_TO_RAD = Math.PI / 180;
Matrix.prototype.prependTransform = function (x, y, scaleX, scaleY, rotation, skewX, skewY, regX, regY) {
    if (rotation % 360) {
        var r = rotation * Matrix.DEG_TO_RAD;
        var cos = Math.cos(r);
        var sin = Math.sin(r);
    } else {
        cos = 1;
        sin = 0;
    }

    if (regX || regY) {
        // append the registration offset:
        this.tx -= regX;
        this.ty -= regY;
    }
    if (skewX || skewY) {
        // TODO: can this be combined into a single prepend operation?
        skewX *= Matrix.DEG_TO_RAD;
        skewY *= Matrix.DEG_TO_RAD;
        this.prepend(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, 0, 0);
        this.prepend(Math.cos(skewY), Math.sin(skewY), -Math.sin(skewX), Math.cos(skewX), x, y);
    } else {
        this.prepend(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, x, y);
    }
    return this;
};

Matrix.prototype.prepend = function (a, b, c, d, tx, ty) {
    var tx1 = this.tx;
    if (a != 1 || b != 0 || c != 0 || d != 1) {
        var a1 = this.a;
        var c1 = this.c;
        this.a = a1 * a + this.b * c;
        this.b = a1 * b + this.b * d;
        this.c = c1 * a + this.d * c;
        this.d = c1 * b + this.d * d;
    }
    this.tx = tx1 * a + this.ty * c + tx;
    this.ty = tx1 * b + this.ty * d + ty;
    return this;
};


Matrix.prototype.append = function (a, b, c, d, tx, ty) {
    var tx1 = this.tx;
    if (a != 1 || b != 0 || c != 0 || d != 1) {
        var a1 = this.a;
        var c1 = this.c;
        this.a = a1 * a + this.b * c;
        this.b = a1 * b + this.b * d;
        this.c = c1 * a + this.d * c;
        this.d = c1 * b + this.d * d;
    }
    this.tx = tx1 * a + this.ty * c + tx;
    this.ty = tx1 * b + this.ty * d + ty;
    return this;
};





exports.run = run;