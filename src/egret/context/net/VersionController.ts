/**
 * Copyright (c) 2014,Egret-Labs.org
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of the Egret-Labs.org nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY EGRET-LABS.ORG AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL EGRET-LABS.ORG AND CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
module egret {
    export class VersionController extends egret.EventDispatcher {

        public constructor() {
            super();
        }

        /**
         * 本地版本信息文件存储路径
         */
        private localVersionDataPath:string = "localVersion.manifest";
        /**
         * 本地版本信息文件，记录了本地文件版本信息
         */
        private localVersionData:Object;


        /**
         * 本地版本信息文件存储路径
         */
        private changeVersionDataPath = "version.manifest";
        /**
         * 当前版本信息文件，记录了当前版本中相对于基础版本变化的文件
         */
        private changeVersionData:Object;

        /**
         * 本地版本信息文件存储路径
         */
        private baseVersionDataPath = "base.manifest";
        /**
         * 基础版本信息文件
         */
        private baseVersionData:Object;

        private _load:NativeResourceLoader;

        //获取当前版本号
        private fetchVersion():void {
            this._load = new egret.NativeResourceLoader();
            this._load.addEventListener(egret.IOErrorEvent.IO_ERROR, this.loadError, this);
            this._load.addEventListener(egret.Event.COMPLETE, this.fileLoadComplete, this);

            this.loadBaseVersion();
        }

        private loadBaseVersion():void {
            this.baseVersionData = this.getLocalData(this.baseVersionDataPath);
            this.changeVersionData = this.getLocalData(this.changeVersionDataPath);

            //加载baseVersionData
            var self = this;
            if (this.baseVersionData == null) {
                this.loadFile(this.baseVersionDataPath, function () {
                    self.baseVersionData = self.getLocalData(self.baseVersionDataPath);

                    self.initLocalVersionData();
                });
            }
            else {
                this.initLocalVersionData();
            }
        }

        private initLocalVersionData():void {
            //初始化localVersonData
            this.localVersionData = this.getLocalData(this.localVersionDataPath);
            if (this.localVersionData == null) {
                this.localVersionData = this.baseVersionData;

                for (var key in this.changeVersionData) {
                    if (this.changeVersionData[key]["d"] == 1) {//被删除
                        delete this.localVersionData[key];
                    }
                    else {
                        this.localVersionData[key] = this.changeVersionData[key];
                    }
                }
                egret_native.saveRecord(this.localVersionDataPath, JSON.stringify(this.localVersionData));
            }

            this.loadOver();
        }


        private _call:Function;

        private loadFile(file:string, call:Function = null) {
            this._call = call;
            this._load.load(file, 1000);
        }

        private fileLoadComplete(e:egret.Event):void {
            if (this._call) {
                this._call();
            }
        }

        private loadError(e:egret.IOErrorEvent):void {
            this._load.removeEventListener(egret.IOErrorEvent.IO_ERROR, this.loadError, this);
            this._load.removeEventListener(egret.Event.COMPLETE, this.fileLoadComplete, this);

            this.dispatchEvent(e);
        }

        private loadOver():void {
            this._load.removeEventListener(egret.IOErrorEvent.IO_ERROR, this.loadError, this);
            this._load.removeEventListener(egret.Event.COMPLETE, this.fileLoadComplete, this);

            this.dispatchEvent(new egret.Event(egret.Event.COMPLETE));
        }

        private getLocalData(filePath):Object {
            var data:Object = null;
            if (egret_native.isRecordExists(filePath)) {
                var str:string = egret_native.loadRecord(filePath);
                data = JSON.parse(str);
            }
            else if (egret_native.isFileExists(filePath)) {
                var str:string = egret_native.readFileSync(filePath);
                data = JSON.parse(str);
            }
            return data;
        }

        /**
         * 获取所有有变化的文件
         * @returns {Array<any>}
         */
        public getChangeList():Array<any> {
            var list:Array<any> = [];
            for (var key in this.changeVersionData) {
                if (this.changeVersionData[key]["d"] == 1) {//被删除
                    delete this.baseVersionData[key];
                }
                else {
                    this.baseVersionData[key] = this.changeVersionData[key];
                }
            }

            for (var key in this.baseVersionData) {
                if (this.localVersionData[key] == null || !this.compareVersion(this.localVersionData, this.baseVersionData, key)) {
                    list.push({"url": key, "size": this.baseVersionData[key]["s"]})
                }
            }
            return list;
        }

        private compareVersion(oldVersion:Object, newVersion:Object, url:string):boolean {
            if (newVersion[url] == null || newVersion[url] == null) {
                return false;
            }
            return oldVersion[url]["v"] == newVersion[url]["v"];
        }

        /**
         * 检查文件是否是最新版本
         */
        public checkIsNewVersion(url:string):boolean {
            if (this.changeVersionData[url] != null) {//在变化版本里
                if (this.compareVersion(this.changeVersionData, this.localVersionData, url)) {
                    return true;
                }
            }
            else if (this.baseVersionData[url] != null) {//在基础版本里
                if (this.compareVersion(this.baseVersionData, this.localVersionData, url)) {
                    return true;
                }
            }
            return false;
        }

        /**
         * 保存本地版本信息文件
         */
        public saveVersion(url:string):void {
            var change = false;
            if (this.changeVersionData[url] != null) {//在变化版本里
                if (!this.compareVersion(this.changeVersionData, this.localVersionData, url)) {
                    change = true;
                    this.localVersionData[url] = this.changeVersionData[url];
                }
            }
            else if (this.baseVersionData[url] != null) {//在基础版本里
                if (!this.compareVersion(this.baseVersionData, this.localVersionData, url)) {
                    change = true;
                    this.localVersionData[url] = this.baseVersionData[url];
                }
            }

            if (change) {
                egret_native.saveRecord(this.localVersionDataPath, JSON.stringify(this.localVersionData));
            }
        }
    }
}
