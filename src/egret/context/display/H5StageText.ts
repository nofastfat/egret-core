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

    /**
     * @class egret.StageText
     * @classdesc
     * @extends egret.HashObject
     */
    export class H5StageText extends StageText {

        private div:any;
        private inputElement:any;

        private _shape:egret.Shape;

        constructor() {
            super();

//            if (H5StageText.DIV == null) {
                var scaleX = egret.StageDelegate.getInstance().getScaleX();
                var scaleY = egret.StageDelegate.getInstance().getScaleY();

                var div = egret.Browser.getInstance().$new("div");
                div.position.x = 0;
                div.position.y = 0;
                div.scale.x = scaleX;
                div.scale.y = scaleY;
                div.transforms();
                div.style[egret_dom.getTrans("transformOrigin")] = "0% 0% 0px";
                this.div = div;

                var inputElement = document.createElement("textarea");
                inputElement.type = "text";
                inputElement.style["resize"] = "none";
                this.inputElement = inputElement;
                this.inputElement.value = "";

//                H5StageText.INPUT = this.inputElement;
                div.appendChild(inputElement);

                //修改属性
//            this.setElementStyle("fontStyle", this._italic ? "italic" : "normal");
//            this.setElementStyle("fontWeight", this._bold ? "bold" : "normal");
//            this.setElementStyle("textAlign", this._textAlign);
                this.setElementStyle("color", "#000000");
                this.setElementStyle("width", egret.MainContext.instance.stage.stageWidth + "px");
                this.setElementStyle("height", 0 + "px");

                this.setElementStyle("fontSize", 30 + "px");
                //默认值
                this.setElementStyle("border", "none");
//            this.setElementStyle("background", "none");
                this.setElementStyle("margin", "0");
                this.setElementStyle("padding", "0");
                this.setElementStyle("outline", "medium");
                this.setElementStyle("verticalAlign", "top");
                this.setElementStyle("wordBreak", "break-all");
                this.setElementStyle("overflow", "hidden");

                var call = function (e) {
                    e.stopPropagation();
                }
                inputElement.addEventListener("mousedown", call);
                inputElement.addEventListener("touchstart", call);
                inputElement.addEventListener("MSPointerDown", call);


                var stage:egret.Stage = egret.MainContext.instance.stage;
                var stageWidth:number = stage.stageWidth;
                var stageHeight:number = stage.stageHeight;
                var shape:egret.Shape = new egret.Shape();
                shape.graphics.beginFill(0x000000, .7);
                shape.graphics.drawRect(0, 0, stageWidth, stageHeight);
                shape.graphics.endFill();
                shape.width = stageWidth;
                shape.height = stageHeight;
                shape.touchEnabled = true;

                this._shape = shape;
//            }

            this.getStageDelegateDiv().appendChild(this.div);
        }

        private getStageDelegateDiv():any {
            var stageDelegateDiv = egret.Browser.getInstance().$("#StageDelegateDiv");
            if (!stageDelegateDiv) {
                stageDelegateDiv = egret.Browser.getInstance().$new("div");
                stageDelegateDiv.id = "StageDelegateDiv";
//                stageDelegateDiv.style.position = "absolute";
                var container = document.getElementById(egret.StageDelegate.canvas_div_name);
                container.appendChild(stageDelegateDiv);
                stageDelegateDiv.transforms();
            }
            return stageDelegateDiv;
        }

        /**
         * @method egret.StageText#open
         * @param x {number}
         * @param y {number}
         * @param width {number}
         * @param height {number}
         */
        public _open(x:number, y:number, width:number = 160, height:number = 21):void {

            this.inputElement.setAttribute("maxlength", this._maxChars > 0 ? this._maxChars : -1);
        }

        public changePosition(x:number, y:number):void {
            if (this._isShow) {
                var scaleX = egret.StageDelegate.getInstance().getScaleX();
                var scaleY = egret.StageDelegate.getInstance().getScaleY();

                this.div.position.x = 0;//x * scaleX;
                this.div.position.y = y * scaleY;
                this.div.transforms();
            }
        }

        private _isShow:boolean = false;
        /**
         * @method egret.StageText#add
         */
        public _show():void {
            this._isShow = true;
            if (this._multiline
                && egret.MainContext.instance.stage.stageWidth * 5 < egret.MainContext.instance.stage.stageHeight * 4) {
                this.setElementStyle("height", 110 + "px");
            }
            else {
                this.setElementStyle("height", 40 + "px");
            }
            //打开
            var txt = this._getText();
            this.inputElement.value = txt;
            var self = this;
            this.inputElement.oninput = function () {
                self.textValue = self.inputElement.value;
                self.dispatchEvent(new egret.Event("updateText"));
            };
            this.setElementStyle("border", "1px solid red");
            this.inputElement.selectionStart = txt.length;
            this.inputElement.selectionEnd = txt.length;
            this.inputElement.focus();

            if (this._shape && this._shape.parent == null) {
                egret.MainContext.instance.stage.addChild(this._shape);
            }
        }

        public _hide():void {
            this._isShow = false;
            this.inputElement.oninput = function () {
            };
            this.setElementStyle("border", "none");
            //关闭
            this.inputElement.value = "";
            this.setElementStyle("height", 0 + "px");
            this.inputElement.blur();

            window.scrollTo(0, 0);

            if (this._shape && this._shape.parent) {
                this._shape.parent.removeChild(this._shape);
            }
        }

        /**
         * @method egret.StageText#remove
         */
        public _remove():void {
            if (this._shape && this._shape.parent) {
                this._shape.parent.removeChild(this._shape);
            }
        }

        private textValue:string = "";
        /**
         * @method egret.StageText#getText
         * @returns {string}
         */
        public _getText():string {
            if (!this.textValue) {
                this.textValue = "";
            }
            return this.textValue;
        }

        /**
         * @method egret.StageText#setText
         * @param value {string}
         */
        public _setText(value:string):void {
            this.textValue = value;

            this.resetText();
        }

        private resetText():void {
            this.inputElement.value = this.textValue;
        }


        private _styleInfoes:Object = {};
        private setElementStyle(style:string, value:any):void {
            if (this.inputElement) {
                if (this._styleInfoes[style] != value) {
                    this.inputElement.style[style] = value;
                    this._styleInfoes[style] = value;
                }
            }
        }
    }
}


egret.StageText.create = function(){
    return new egret.H5StageText();
}