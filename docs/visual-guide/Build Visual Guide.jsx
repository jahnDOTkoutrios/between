#target "indesign"
/* Build the editable, five-page Tracking Ramp specimen using the actual v8 engine.
 * Run from this folder beside the shipped Tracking Ramp source checkout.
 * Outputs are recreated beside this script. No existing document is edited.
 */
(function () {
    var scriptFile = File($.fileName);
    var folder = (scriptFile.resolve() || scriptFile).parent;
    var sourceFile = File(folder.parent.parent.fsName + "/Tracking Ramp.jsx");
    var report = [], doc = null;
    var oldUnit = app.scriptPreferences.measurementUnit;
    function log(s) {
        report.push(String(s));
        var file = File(folder.fsName + "/build-report.txt"); file.encoding = "UTF-8";
        file.open("w"); file.write(report.join("\n")); file.close();
    }
    function require(ok, message) { if (!ok) { throw Error(message); } }
    try {
        require(sourceFile.exists, "Keep this builder in docs/visual-guide inside the Tracking Ramp repository.");
        app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
        sourceFile.encoding = "UTF-8"; sourceFile.open("r"); var source = sourceFile.read(); sourceFile.close();
        source = source.replace(/^#target[^\n]*\n/, "").replace("run(); // Entry point", "return {resolveTarget:resolveTarget,PreviewSession:PreviewSession,axisInfo:axisInfo,encode:encode};");
        var api = eval(source);
        function font(names) {
            for (var i = 0; i < names.length; i++) { var found = app.fonts.itemByName(names[i]); if (found.isValid) { return found; } }
            throw Error("No suitable font is installed: " + names.join(", "));
        }
        var sans = font(["Arial\tRegular", "Helvetica Neue\tRegular", "Myriad Pro\tRegular"]);
        var bold = font(["Arial\tBold", "Helvetica Neue\tBold", "Myriad Pro\tBold"]);
        var serif = font(["Minion Pro\tRegular", "Times New Roman\tRegular", "Georgia\tRegular"]);
        var variable = font(["Acumin Variable Concept\tRegular", "Myriad Variable Concept\tRegular"]);
        var axes = api.axisInfo(variable), weight = null;
        for (var a = 0; a < axes.length; a++) { if (/weight|wght/i.test(axes[a].name)) { weight = axes[a]; break; } }
        require(weight, "A weight axis is required for specimen 09.");
        var destination = File(folder.fsName + "/Tracking Ramp - Visual Guide.indd");
        for (var openIndex = app.documents.length - 1; openIndex >= 0; openIndex--) {
            var openDocument = app.documents[openIndex];
            if (openDocument.saved && openDocument.fullName.fsName === destination.fsName) {
                require(!openDocument.modified, "The visual guide has unsaved edits. Save a separate copy before rebuilding it.");
                openDocument.close(SaveOptions.NO);
            }
        }
        doc = app.documents.add();
        doc.documentPreferences.properties = {facingPages:false, pagesPerDocument:1, pageWidth:"420mm", pageHeight:"594mm"};
        doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
        doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
        var page = doc.pages[0], W = Number(doc.documentPreferences.pageWidth), H = Number(doc.documentPreferences.pageHeight);
        page.marginPreferences.properties = {top:48,left:48,bottom:48,right:48};
        var ground = doc.layers[0]; ground.name = "00 - Paper and specimen cards";
        var examples = doc.layers.add({name:"02 - Editable numbered specimens"});
        var labels = doc.layers.add({name:"01 - Guide titles and settings"});
        function color(name, rgb) { return doc.colors.add({name:name,model:ColorModel.PROCESS,space:ColorSpace.RGB,colorValue:rgb}); }
        var ink=color("Guide - Ink",[24,24,24]), muted=color("Guide - Slate",[100,100,100]);
        var blue=color("Guide - Blue",[45,45,45]), mist=color("Guide - Mist",[190,190,190]);
        var paper=color("Guide - Warm paper",[255,255,255]), rule=color("Guide - Rule",[215,215,215]);
        var white=doc.swatches.itemByName("Paper"), none=doc.swatches.itemByName("None");
        function box(name,bounds,fill,layer,stroke) {
            var r=page.rectangles.add({name:name,itemLayer:layer,geometricBounds:bounds,fillColor:fill,strokeWeight:stroke?0.5:0});
            r.strokeColor=stroke||none; r.textWrapPreferences.textWrapMode=TextWrapModes.NONE; return r;
        }
        box("Page - warm paper",[0,0,H,W],paper,ground);
        var styleGroup=doc.paragraphStyleGroups.add({name:"Visual guide"});
        function style(name,size,leading,face,fill) { return styleGroup.paragraphStyles.add({name:name,pointSize:size,leading:leading,appliedFont:face,fillColor:fill,hyphenation:false,spaceBefore:0,spaceAfter:0}); }
        var st={eye:style("01 Eyebrow",11,14,bold,blue),title:style("02 Page title",62,68,bold,ink),intro:style("03 Introduction",14,20,sans,muted),card:style("04 Specimen title",17,21,bold,ink),settings:style("05 Settings",10.5,14,sans,muted),note:style("06 Observation",9.5,13,sans,muted),foot:style("07 Instructions",11,15,sans,muted)};
        var allText=[], specimens=[];
        function text(name,content,bounds,paragraphStyle,layer) {
            var tf=page.textFrames.add({name:name,itemLayer:layer||labels,geometricBounds:bounds});
            tf.textFramePreferences.insetSpacing=0; tf.textFramePreferences.ignoreWrap=true; tf.strokeWeight=0; tf.strokeColor=none;
            tf.textFramePreferences.firstBaselineOffset=FirstBaseline.ASCENT_OFFSET;
            tf.contents=content; tf.parentStory.texts[0].appliedParagraphStyle=paragraphStyle;
            tf.parentStory.texts[0].appliedCharacterStyle=doc.characterStyles[0];
            allText.push(tf);return tf;
        }
        function specimen(name,content,bounds,size,leading,options) {
            var tf=text(name+" - EDIT ME",content,bounds,doc.paragraphStyles[0],examples), t=tf.parentStory.texts[0];
            t.appliedFont=serif;t.pointSize=size;t.leading=leading;t.fillColor=ink;t.strokeWeight=0;t.tracking=0;
            t.hyphenation=false;t.spaceBefore=0;t.spaceAfter=0;t.alignToBaseline=false;
            if(options&&options.justified)t.justification=Justification.FULLY_JUSTIFIED;
            specimens.push(tf);return tf;
        }
        function settings(extra) {
            var s={scope:0,mode:"word",restart:"never",target:"letters",property:"tracking",min:0,max:180,curve:"linear",power:2,width:22,steps:0,invert:false,points:[],smooth:true,axisName:"",colorA:ink.id,colorB:mist.id,strokeWidth:0.5,replace:true,clearTracking:false,metrics:false,lockLines:false,allowLineBreaks:false,autoStabilize:true,textEnabled:true,missingStyle:"original"};
            for(var k in extra)s[k]=extra[k];return s;
        }
        function apply(tf,extra) {
            app.select(tf); var s=settings(extra), target=api.resolveTarget();
            // Use the complete local story for semantic samples unless explicitly
            // demonstrating live frame scope. Line/frame units still exclude overset.
            if(!extra||extra.scope===undefined)s.scope=target.scopes.length-1;
            var session=new api.PreviewSession(target), result=session.preview(s);session.commit(s);
            if(s.metrics){for(var m=0;m<doc.textFrames.length;m++){if(doc.textFrames[m].extractLabel("TR3.metricsStory")===String(tf.parentStory.id)){doc.textFrames[m].locked=false;doc.textFrames[m].strokeColor=none;doc.textFrames[m].locked=true;}}}
            tf.insertLabel("TrackingRamp.guide.settings",api.encode(result.settings));
            tf.parentStory.recompose();
            log(tf.name+" | "+result.units.length+" units | "+result.passes+" passes | "+(result.lockedBreaks||0)+" fixed breaks | overset="+tf.overflows);
            return result;
        }
        function applyStack(tf, stages) {
            app.select(tf); var target=api.resolveTarget(),session=new api.PreviewSession(target),saved=[];
            for(var i=0;i<stages.length;i++){
                var s=settings(stages[i]);s.scope=target.scopes.length-1;saved.push(s);
                if(i<stages.length-1)session.keep(s);else session.commit(s);
            }
            tf.insertLabel("TrackingRamp.guide.settings",api.encode({stack:saved}));
            log(tf.name+" | "+saved.length+" stacked properties | one Undo group | overset="+tf.overflows);
        }
        text("Guide - eyebrow","TRACKING RAMP 8  /  VISUAL GUIDE",[44,48,66,760],st.eye);
        text("Guide - format","01  /  A2 SPECIMEN SHEET",[44,W-310,66,W-48],st.eye);
        text("Guide - title","Fading, by degrees.",[79,45,159,W-48],st.title);
        text("Guide - introduction","Twelve specimens, from a few letters to a flowing story. Each numbered frame is editable.\rThe settings below were applied by Tracking Ramp itself; the changing text is the demonstration.",[169,48,218,W-48],st.intro);
        var gap=24,cw=(W-96-2*gap)/3,ch=294,top=246;
        function card(index,title,caption,note) {
            var col=(index-1)%3,row=Math.floor((index-1)/3),x=48+col*(cw+gap),y=top+row*(ch+24);
            // Leave the specimen areas open on the white page.
            box("Card "+index+" - hairline",[y,x,y+0.5,x+cw],rule,ground);
            text((index<10?"0":"")+index+" - title",(index<10?"0":"")+index+"   "+title,[y+15,x+14,y+42,x+cw-14],st.card);
            text(index+" - settings",caption,[y+47,x+14,y+89,x+cw-14],st.settings);
            var n=text(index+" - observation",note,[y+270,x+14,y+290,x+cw-14],st.note);
            return {x:x+14,y:y+99,w:cw-28,h:161,note:n};
        }
        var c=card(1,"A widening sentence","Tracking / Word / Linear / 0 to 180\rChange: Letters / Auto steps / Entire story","Long text: one continuous ramp across all words.");
        var f=specimen("01 - Tracking by word - linear 0-180","Light had been working quietly. Each morning it crossed the room, touched the same objects, and took a little color with it. Blue softened into grey. A photograph grew pale at its edges, while the face at its center remained almost familiar.",[c.y,c.x,c.y+c.h,c.x+c.w],14,21);apply(f,{});
        c=card(2,"Only the spaces","Tracking / Word / Linear / 0 to 850\rChange: Spaces / Auto steps / Entire story","The letters stay together; the gaps gradually open.");
        f=specimen("02 - Spaces only - linear 0-850","Some things fade\rbetween the words\rwe leave behind.",[c.y+8,c.x,c.y+c.h,c.x+c.w],27,45);apply(f,{target:"spaces",max:850});
        c=card(3,"A bell in every line","Tracking / Word / Gaussian / 0 to 260\rRestart: Line / Justified / Breaks: on / Metrics: on","5 pt numbers print in the gap below each text row.");
        f=specimen("03 - Justified line bells with printable metrics","The room keeps a softer record of us. Curtains lose their blue. Paper turns warm at the edges. Every line begins again, opening at its center and returning to quiet before the next breath.",[c.y-2,c.x,c.y+c.h-1,c.x+c.w],12.5,24,{justified:true});apply(f,{restart:"line",curve:"gaussian",max:260,metrics:true,scope:0,allowLineBreaks:true});
        c=card(4,"Small, large, small","Font size / Character / Gaussian / 14 to 48 pt\rRestart: Word / Change: Both / Auto steps","The complete size curve starts again inside each word.");
        f=specimen("04 - Font size - character bells per word","fading\rfading\rfading",[c.y,c.x,c.y+c.h,c.x+c.w],30,51);apply(f,{property:"pointSize",mode:"character",restart:"word",target:"both",curve:"gaussian",min:14,max:48});
        c=card(5,"A rising memory","Baseline shift / Character / Sine / 0 to 14 pt\rRestart: Never / Change: Letters / Auto steps","The glyphs rise and fall. Leading stays at 48 pt.");
        f=specimen("05 - Baseline shift - sine 0-14 pt","What stays\rwhen light\rleaves?",[c.y+12,c.x,c.y+c.h,c.x+c.w],30,48);apply(f,{property:"baselineShift",mode:"character",curve:"sine",max:14});
        c=card(6,"Color, then begin again","Character color / Word / Linear / Ink to Mist\rRestart: Paragraph / Change: Both / Auto steps","Each paragraph repeats the same color transition.");
        f=specimen("06 - Character color - word ramp per paragraph","A letter fades from black to a quiet trace. Its message remains, even as the ink grows light.\rThe second memory begins in darkness, then follows the first toward the edge of sight.",[c.y,c.x,c.y+c.h,c.x+c.w],16,23);f.parentStory.texts[0].spaceAfter=10;apply(f,{property:"fillColor",restart:"paragraph",target:"both",max:100});
        c=card(7,"A sentence stretches","Horizontal scale / Word / Linear / 65 to 145%\rRestart: Sentence / Change: Both / Auto steps","Three sentences; three independent distributions.");
        f=specimen("07 - Horizontal scale - word ramp per sentence","The edges grow quiet.\rThe hours spread thin.\rThe colors drift away.",[c.y+5,c.x,c.y+c.h,c.x+c.w],25,48);apply(f,{property:"horizontalScale",restart:"sentence",target:"both",min:65,max:145});
        c=card(8,"Keep, then add","Skew -20 to 20 degrees; tracking 0 to 110\rUse + Add property to keep skew, then add tracking.\rLower sample: rotation -12 to 12 degrees / Sine","Two stacked properties above; separate rotation below.");
        f=specimen("08A - Kept skew plus tracking - two-property stack","a leaning memory",[c.y+8,c.x,c.y+70,c.x+c.w],28,45);applyStack(f,[{property:"skew",mode:"character",min:-20,max:20},{property:"tracking",mode:"word",min:0,max:110}]);
        f=specimen("08B - Rotation - character sine minus12-plus12","letters drift away",[c.y+91,c.x,c.y+c.h,c.x+c.w],28,45);apply(f,{property:"characterRotation",mode:"character",curve:"sine",min:-12,max:12});
        var wmin=Math.max(weight.min,100),wmax=Math.min(weight.max,800);
        c=card(9,"Weight and outline","Variable weight: "+wmax+" to "+wmin+" / Word / Linear\rStroke width: 0 to 1 pt / Character / Linear","Axis: "+weight.name+". The lower sample has a white fill.");
        f=specimen("09A - Variable font weight - inverted word ramp","Light loses weight.",[c.y+7,c.x,c.y+78,c.x+c.w],28,42);f.parentStory.texts[0].appliedFont=variable;apply(f,{property:"designAxes",axisName:weight.name,min:wmin,max:wmax,invert:true});
        f=specimen("09B - Stroke width - character linear 0-1 pt","almost gone",[c.y+95,c.x,c.y+c.h,c.x+c.w],39,48);f.parentStory.texts[0].fillColor=white;f.parentStory.texts[0].strokeColor=ink;apply(f,{property:"strokeWeight",mode:"character",target:"both",max:1});
        c=card(10,"A shaped measure","Line width: 58 to 100% / Centered / Smooth\rIndependent Gaussian contour; text tracking: 0","A longer passage flows through a changing frame width.");
        f=specimen("10 - Independent frame contour - Gaussian 58-100 percent","A room can fade without becoming empty. Light still reaches the table. A cup still marks its small circle on the wood. Only the boundaries change: the space narrows, opens, and narrows again, holding a different measure of the same familiar words. We keep reading until the edges close around the last quiet trace of a place we thought would always stay.",[c.y,c.x,c.y+c.h,c.x+c.w],12,16);
        f.strokeColor=rule;f.strokeWeight=0.5;
        apply(f,{textEnabled:false,curve:"linear",frameWidth:{enabled:true,linked:false,min:58,max:100,unit:"%",anchor:"center",smooth:true,steps:12,curve:{curve:"gaussian",power:2,width:29,invert:false,points:[],smooth:true,steps:0}}});
        c=card(11,"What fits the frame","Current frame / Character / Linear / 0 to 100\rSame longer text; left: original / right: applied","Text leaving the right frame returns to its baseline.");
        var narrow=(c.w-18)/2,passage="Light leaves slowly. It crosses the room every morning, taking a little color from the curtains and a little certainty from the photograph. The objects remain in place. Their edges become less exact, until memory supplies the details that the eye can no longer find.";
        var left=specimen("11A - Frame scope control - unchanged text",passage,[c.y+14,c.x,c.y+c.h,c.x+narrow],12,18);
        var right=specimen("11B - Frame scope - adaptive tracking 0-100",passage,[c.y+14,c.x+narrow+18,c.y+c.h,c.x+c.w],12,18);apply(right,{scope:0,mode:"character",max:100});
        text("11A - control label","ORIGINAL",[c.y-4,c.x,c.y+10,c.x+narrow],st.eye);
        text("11B - effect label","APPLIED",[c.y-4,c.x+narrow+18,c.y+10,c.x+c.w],st.eye);
        left.insertLabel("TrackingRamp.guide.expectedOverset","1");right.insertLabel("TrackingRamp.guide.expectedOverset","1");
        require(right.characters.length<left.characters.length,"Frame-scope example must contract visibly.");
        var end=right.characters.lastItem().index;
        for(var hidden=end+1;hidden<right.parentStory.characters.length;hidden++){require(right.parentStory.characters[hidden].tracking===0,"Overset text must retain its zero baseline.");}
        log("PASS frame comparison: original "+left.characters.length+" visible characters; applied "+right.characters.length+"; overset tracking remains 0.");
        c=card(12,"One linked story","Tracking / Frame / Linear / 0 to 140\rEntire story / Change: Both / Two linked frames","The curve assigns one value to each visible frame.");
        left=specimen("12A - Linked story frame 1 - tracking 0","Fading is not always a departure. Sometimes it is a change in how a thing remains. The photograph stays on the shelf, the path stays through the grass, and the voice stays somewhere in the room. What disappears is the sharp border between presence and memory. We learn the shape again through its softer edges.",[c.y+14,c.x,c.y+c.h,c.x+narrow],12,18);
        right=specimen("12B - Linked story frame 2 - tracking 140","",[c.y+14,c.x+narrow+18,c.y+c.h,c.x+c.w],12,18);left.nextTextFrame=right;apply(left,{mode:"frame",target:"both",max:140,scope:1});
        text("12A - frame label","FRAME 1 / 0",[c.y-4,c.x,c.y+10,c.x+narrow],st.eye);
        text("12B - frame label","FRAME 2 / 140",[c.y-4,c.x+narrow+18,c.y+10,c.x+c.w],st.eye);
        left.insertLabel("TrackingRamp.guide.expectedOverset","1");right.insertLabel("TrackingRamp.guide.expectedOverset","1");
        box("Footer rule",[1538,48,1538.5,W-48],rule,ground);
        text("Footer - open","OPEN & EXPLORE",[1553,48,1572,48+cw],st.eye);
        text("Footer - open instructions","Open the INDD or IDML. In Layers, select a numbered frame on the Editable specimens layer. Run Tracking Ramp.jsx.",[1578,48,1630,48+cw],st.foot);
        text("Footer - reapply","ADD ANOTHER PROPERTY",[1553,48+cw+gap,1572,48+2*cw+gap],st.eye);
        text("Footer - reapply instructions","Set an effect, click + Add property, then choose the next property. Apply all keeps the stack; Cancel restores the starting state.",[1578,48+cw+gap,1630,48+2*cw+gap],st.foot);
        text("Footer - compare","READ THE RESULTS",[1553,48+2*(cw+gap),1572,W-48],st.eye);
        text("Footer - compare instructions","Allow added line breaks is off by default. Auto-stabilize can use Fixed sampling without changing paragraph structure.",[1578,48+2*(cw+gap),1630,W-48],st.foot);
        text("Footer - repository","github.com/jahnDOTkoutrios/indesign-tracking-ramp   /   v8.0.0   /   Editable specimens, actual applied values",[1650,48,1670,W-48],st.note);
        // Page 2 keeps the same quiet typography and adds the additional targets.
        page=doc.pages.add();page.marginPreferences.properties={top:48,left:48,bottom:48,right:48};
        box("Page 2 - white paper",[0,0,H,W],paper,ground);
        text("Page 2 - eyebrow","TRACKING RAMP 8  /  VISUAL GUIDE",[44,48,66,760],st.eye);
        text("Page 2 - format","02  /  UNDERLINES & INDENTS",[44,W-345,66,W-48],st.eye);
        text("Page 2 - title","A line can change.",[79,45,159,W-48],st.title);
        text("Page 2 - introduction","Weight and offset follow characters or words. Indents move complete paragraphs.\rEach example keeps its saved baseline, so you can replace the curve and explore.",[169,48,218,W-48],st.intro);
        function section(number,title,caption,y){
            box(number+" - section rule",[y,48,y+.5,W-48],rule,ground);
            text(number+" - section title",number+"   "+title,[y+15,62,y+43,W-62],st.card);
            text(number+" - section settings",caption,[y+49,62,y+87,W-62],st.settings);
        }
        var half=(W-124-34)/2;
        section("13","Underline weight","Character or Word / Auto steps / 0.2 to 6 pt / Change: Letters\rThe text stays the same size while the underline grows or forms a bell.",246);
        text("13A - sublabel","CHARACTER / LINEAR",[350,62,370,62+half],st.eye);
        f=specimen("13A - Underline weight - character linear 0.2-6 pt","the ink grows quiet",[393,62,492,62+half],42,64);apply(f,{property:"underlineWeight",mode:"character",min:.2,max:6});
        text("13B - sublabel","WORD / GAUSSIAN",[350,96+half,370,W-62],st.eye);
        f=specimen("13B - Underline weight - word Gaussian 0.2-6 pt","one line holds a memory",[393,96+half,515,W-62],34,60);apply(f,{property:"underlineWeight",mode:"word",curve:"gaussian",min:.2,max:6});
        text("13 - observation","Underlining switches on automatically. Existing underline color, style and offset are retained.",[530,62,554,W-62],st.note);
        section("14","Underline offset","Character: Sine / Word: Linear / -2 to 12 pt / Underline weight held at 1 pt\rNegative offsets move above the baseline; positive offsets move below it.",588);
        text("14A - sublabel","CHARACTER / SINE",[691,62,711,W-62],st.eye);
        f=specimen("14A - Underline offset - character sine minus2-plus12 pt","the line drifts below the letters",[731,62,824,W-62],40,68);f.parentStory.texts[0].underlineWeight=1;apply(f,{property:"underlineOffset",mode:"character",curve:"sine",min:-2,max:12});
        text("14B - sublabel","WORD / LINEAR",[839,62,859,W-62],st.eye);
        f=specimen("14B - Underline offset - word linear minus2-plus12 pt","the words hold another horizon",[881,62,974,W-62],38,68);f.parentStory.texts[0].underlineWeight=1;apply(f,{property:"underlineOffset",mode:"word",min:-2,max:12});
        section("15","Paragraph indents","Paragraph / Linear / Four steps per sample / One value for each complete paragraph\rLeft and right: 0 to 72 pt. First line: -18 to 36 pt, with a fixed 18 pt left indent.",1012);
        var paragraphText="Light reaches the table. A little color leaves the room.\rMemory keeps the edges. A familiar shape becomes less exact.\rThe page grows quieter. We read what remains between words.\rNothing leaves at once. The last trace takes its time.";
        var indentNames=["leftIndent","rightIndent","firstLineIndent"],indentLabels=["LEFT INDENT / 0 TO 72 PT","RIGHT INDENT / 0 TO 72 PT","FIRST LINE / -18 TO 36 PT"];
        for(var ind=0;ind<3;ind++){
            var px=62+ind*(cw+gap);
            text("15"+String.fromCharCode(65+ind)+" - sublabel",indentLabels[ind],[1117,px,1138,px+cw-28],st.eye);
            f=specimen("15"+String.fromCharCode(65+ind)+" - Paragraph "+indentNames[ind]+" - four paragraph linear ramp",paragraphText,[1160,px,1460,px+cw-28],17,24);
            f.parentStory.texts[0].spaceAfter=12;
            if(ind===2)f.parentStory.texts[0].leftIndent=18;
            apply(f,{property:indentNames[ind],mode:"paragraph",target:"both",min:ind===2?-18:0,max:ind===2?36:72});
        }
        box("Page 2 - footer rule",[1538,48,1538.5,W-48],rule,ground);
        text("Page 2 - footer label","WHOLE PARAGRAPHS",[1553,48,1572,48+cw],st.eye);
        text("Page 2 - footer scope","A partial selection includes each paragraph it touches. Indents can also affect a continuation in another frame or overset.",[1578,48,1630,48+cw],st.foot);
        text("Page 2 - footer replace label","REPLACE & RESTORE",[1553,48+cw+gap,1572,48+2*cw+gap],st.eye);
        text("Page 2 - footer replace","Cancel restores the starting formatting. Reapplying restores old targets before assigning new values. Underline automatic values are preserved.",[1578,48+cw+gap,1630,48+2*cw+gap],st.foot);
        text("Page 2 - footer paragraph label","ONE CURVE PER SCOPE",[1553,48+2*(cw+gap),1572,W-48],st.eye);
        text("Page 2 - footer paragraph","Indent properties use Paragraph, Both and Never restart. Curves run across the selected paragraphs without splitting their formatting.",[1578,48+2*(cw+gap),1630,W-48],st.foot);
        text("Page 2 - repository","github.com/jahnDOTkoutrios/indesign-tracking-ramp   /   v8.0.0   /   Underline and paragraph properties",[1650,48,1670,W-48],st.note);
        // Page 3 demonstrates managed, independently indented rows.
        page=doc.pages.add();page.marginPreferences.properties={top:48,left:48,bottom:48,right:48};
        box("Page 3 - white paper",[0,0,H,W],paper,ground);
        text("Page 3 - eyebrow","TRACKING RAMP 8  /  VISUAL GUIDE",[44,48,66,760],st.eye);
        text("Page 3 - format","03  /  LINE LENGTH",[44,W-310,66,W-48],st.eye);
        text("Page 3 - title","A changing measure.",[79,45,159,W-48],st.title);
        text("Page 3 - introduction","Allow added line breaks chooses the compromise: per-line indents, or a frame contour.\rTurn it off to preserve paragraphs. Turn it on for managed, independently fitted rows.",[169,48,218,W-48],st.intro);
        section("16","A longer bell","Line length / Gaussian / 45 to 100% / Auto steps / Added line breaks: ON\rEach fitted row is a paragraph with equal left and right indents.",246);
        var lengthPassage="The light fades slowly enough that we almost miss the change. A curtain gives up its blue, a table loses the hard edge of its shadow, and the afternoon makes a softer shape around the room. Nothing has gone, yet everything has moved a little further into memory. We read the same words again and find more space around them. The measure opens toward the middle, holding a longer breath, then draws inward as the passage reaches its end.\rA photograph remains beside the window. Its colors have grown quiet, but the face is still there. Fading can be a way of staying: less exact, less certain, and still recognizable. What remains asks us to look more slowly, until the last lines gather around a small and familiar trace.";
        f=specimen("16 - Line length - long Gaussian centered 45-100 percent",lengthPassage,[354,96,965,W-96],23,34);
        var lengthResult=apply(f,{scope:0,property:"lineLength",mode:"line",target:"both",curve:"gaussian",min:45,max:100,allowLineBreaks:true});
        require(lengthResult.lineLength&&lengthResult.managedParagraphs>0,"Line-length bell must create managed rows.");
        for(var row=0;row<lengthResult.units.length;row++){var para=f.parentStory.characters.item(lengthResult.units[row].spans[0].start).paragraphs.firstItem();require(para.lines.length===1,"Guide line-length paragraph must occupy one row.");require(Math.abs(Number(para.leftIndent)-Number(para.rightIndent))<.001,"Guide row must be centered.");}
        section("17","A shorter ramp","Line length / Linear / 40 to 100% / Auto steps / Added line breaks: OFF\rA centered contour follows frame height. The paragraph stays intact.",1012);
        f=specimen("17 - Line length - no added breaks - linear contour 40-100 percent","A trace remains. The color leaves first, then the sharp edges of the room. What stays is a rhythm: a few words held close, a longer sentence opening into light, and the quiet after it.",[1122,96,1465,W-96],30,44);
        f.strokeColor=rule;f.strokeWeight=.5;
        var unbroken=apply(f,{scope:0,property:"lineLength",mode:"line",target:"both",curve:"linear",min:40,max:100,allowLineBreaks:false});
        require(unbroken.lineLengthContour&&f.parentStory.paragraphs.length===1,"No-break guide specimen must preserve its paragraph.");
        box("Page 3 - footer rule",[1538,48,1538.5,W-48],rule,ground);
        text("Page 3 - footer try label","TRY A DIFFERENT CURVE",[1553,48,1572,48+cw],st.eye);
        text("Page 3 - footer try","Select specimen 16 or 17. Choose Line length - centered. Compare Allow added line breaks on and off, then change the curve or steps.",[1578,48,1630,48+cw],st.foot);
        text("Page 3 - footer restore label","REPLACE & RESTORE",[1553,48+cw+gap,1572,48+2*cw+gap],st.eye);
        text("Page 3 - footer restore","Replace restores owned gaps or the original frame before applying the new mode. Cancel restores everything. Apply keeps one Undo action.",[1578,48+cw+gap,1630,48+2*cw+gap],st.foot);
        text("Page 3 - footer frame label","ONE RECTANGULAR FRAME",[1553,48+2*(cw+gap),1572,W-48],st.eye);
        text("Page 3 - footer frame","Both modes need one unthreaded rectangular frame. With added breaks, paragraph-aware styles may repeat on the new rows.",[1578,48+2*(cw+gap),1630,W-48],st.foot);
        text("Page 3 - repository","github.com/jahnDOTkoutrios/indesign-tracking-ramp   /   v8.0.0   /   Centered per-line measures",[1650,48,1670,W-48],st.note);
        // Page 4 blends the actual values of editable character styles.
        page=doc.pages.add();page.marginPreferences.properties={top:48,left:48,bottom:48,right:48};
        box("Page 4 - white paper",[0,0,H,W],paper,ground);
        text("Page 4 - eyebrow","TRACKING RAMP 8  /  VISUAL GUIDE",[44,48,66,760],st.eye);
        text("Page 4 - format","04  /  CHARACTER-STYLE BLEND",[44,W-390,66,W-48],st.eye);
        text("Page 4 - title","Between two styles.",[79,45,159,W-48],st.title);
        text("Page 4 - introduction","Choose Style A and Style B. One curve blends their shared numeric settings and compatible colors.\rFont families and on/off settings stay unchanged; the source character styles remain editable.",[169,48,218,W-48],st.intro);
        var blendGroup=doc.characterStyleGroups.add({name:"Guide blends"});
        var blendBase=blendGroup.characterStyles.add({name:"Base - small ink",pointSize:14,tracking:0,baselineShift:0,fillColor:ink});
        var blendA=blendGroup.characterStyles.add({name:"A - small ink",basedOn:blendBase});
        var blendB=blendGroup.characterStyles.add({name:"B - large mist",basedOn:blendBase,pointSize:30,tracking:160,baselineShift:6,fillColor:mist});
        section("18","One curve, several settings","Character-style blend / Word / Linear / 0 to 100% / Auto steps\rA: 14 pt, tracking 0, shift 0, Ink. B: 30 pt, tracking 160, shift 6, Mist.",246);
        var blendPassage="A memory fades through several changes at once. The letters grow, the spaces open, and the ink gives way to a softer grey. The words remain themselves, even as their presence changes. We can follow the whole passage from a small, dark beginning toward a larger and quieter end, or bend the curve and bring its strongest moment back into the center. Nothing is altered in the source styles. The page holds the steps between them.";
        f=specimen("18 - Character-style blend - long word ramp - four attributes",blendPassage,[354,62,790,W-62],24,44);
        var blendResult=apply(f,{property:"styleBlend",mode:"word",target:"letters",styleA:blendA.id,styleB:blendB.id,min:0,max:100});
        require(blendResult.settings.blendDefinition.attributes.length===4,"Guide blend must interpolate four attributes together.");
        require(blendA.pointSize===14&&blendB.pointSize===30,"Guide source styles must remain unchanged.");
        var bellA=blendGroup.characterStyles.add({name:"Bell A - small ink",basedOn:blendA,pointSize:32});
        var bellB=blendGroup.characterStyles.add({name:"Bell B - large mist",basedOn:blendB,pointSize:72});
        section("19","A blend inside every word","Character / Restart: Word / Gaussian / 0 to 100% / Letters\rA: 32 pt, tracking 0, Ink. B: 72 pt, tracking 160, Mist.\rBlend attributes: Font size, Tracking and Character color. Baseline shift is excluded.",830);
        f=specimen("19 - Character-style blend - character bells per word - three attributes","fading slowly\rleaving softly",[939,62,1110,W-62],24,86);
        apply(f,{property:"styleBlend",mode:"character",restart:"word",target:"letters",styleA:bellA.id,styleB:bellB.id,styleAttributes:["pointSize","tracking","fillColor"],curve:"gaussian",min:0,max:100});
        section("20","Variable-font endpoints","Word / Linear inverted / B to A / Same variable-font file\rA: 24 pt, Weight "+wmin+". B: 40 pt, Weight "+wmax+". Size and axes blend together.",1132);
        var variableA=blendGroup.characterStyles.add({name:"Axis A - light",appliedFont:variable,pointSize:24});
        var variableB=blendGroup.characterStyles.add({name:"Axis B - heavy",appliedFont:variable,pointSize:40});
        variableA.setNthDesignAxis(weight.index,wmin);variableB.setNthDesignAxis(weight.index,wmax);
        f=specimen("20 - Character-style blend - variable weight and size","Light loses its weight.",[1255,62,1466,W-62],24,64);f.parentStory.texts[0].appliedFont=variable;
        var variableBlend=apply(f,{property:"styleBlend",mode:"word",target:"letters",styleA:variableA.id,styleB:variableB.id,invert:true,min:0,max:100});
        require(variableBlend.settings.blendDefinition.attributes.length===2,"Guide variable blend must include axes and size.");
        box("Page 4 - footer rule",[1538,48,1538.5,W-48],rule,ground);
        text("Page 4 - footer endpoints label","EDIT THE ENDPOINTS",[1553,48,1572,48+cw],st.eye);
        text("Page 4 - footer endpoints","Open Character Styles > Guide blends. Change A or B, select its specimen and reapply. Intermediate results are local formatting.",[1578,48,1630,48+cw],st.foot);
        text("Page 4 - footer attributes label","CHOOSE ATTRIBUTES",[1553,48+cw+gap,1572,48+2*cw+gap],st.eye);
        text("Page 4 - footer attributes","Shared supported attributes are automatic. Blend attributes lets you exclude them and lists missing or unsupported values.",[1578,48+cw+gap,1630,48+2*cw+gap],st.foot);
        text("Page 4 - footer keep label","KEEP & RESTORE",[1553,48+2*(cw+gap),1572,W-48],st.eye);
        text("Page 4 - footer keep","Add another property to keep the blend. Cancel restores the starting state. Apply all commits the stack as one Undo action.",[1578,48+2*(cw+gap),1630,W-48],st.foot);
        text("Page 4 - repository","github.com/jahnDOTkoutrios/indesign-tracking-ramp   /   v8.0.0   /   Shared attributes, one blend curve",[1650,48,1670,W-48],st.note);
        // Page 5 demonstrates original-text endpoints and saved complete setups.
        page=doc.pages.add();page.marginPreferences.properties={top:48,left:48,bottom:48,right:48};
        box("Page 5 - white paper",[0,0,H,W],paper,ground);
        text("Page 5 - eyebrow","TRACKING RAMP 8  /  VISUAL GUIDE",[44,48,66,760],st.eye);
        text("Page 5 - format","05  /  SAVED SETUPS",[44,W-310,66,W-48],st.eye);
        text("Page 5 - title","Keep the instructions.",[79,45,159,W-48],st.title);
        text("Page 5 - introduction","A missing endpoint can come from the original text. A saved setup remembers the full sequence.\rReopen an editable specimen: its controls load without changing the document. Preview when ready.",[169,48,218,W-48],st.intro);
        var originalA=blendGroup.characterStyles.add({name:"Original A - unspecified"});
        var strokeB=blendGroup.characterStyles.add({name:"Original B - skew and stroke",skew:24,strokeWeight:2,strokeColor:ink});
        section("21","An outline from nothing","Word / Linear / 0 to 100% / Missing values: Original text\rA leaves skew and stroke unspecified. B defines skew 24 degrees, stroke 2 pt and Ink.",246);
        f=specimen("21 - One-sided style blend - skew and visible stroke","A trace remains.",[354,62,574,W-62],58,86);
        f.parentStory.texts[0].skew=0;f.parentStory.texts[0].strokeColor=none;
        apply(f,{property:"styleBlend",mode:"word",target:"both",styleA:originalA.id,styleB:strokeB.id,min:0,max:100,missingStyle:"original"});
        section("22","The original text is the starting point","Word / Linear / 0 to 100% / Original text endpoints\rOriginal sizes: 24 pt, then 18 pt. B defines 30 pt and skew 18 degrees. Both-missing settings stay unchanged.",612);
        var originalB=blendGroup.characterStyles.add({name:"Original B - size and skew",pointSize:30,skew:18});
        var originalPassage="The first words have already changed before the curve begins. They are a little larger, holding their shape against the light. The rest of the passage starts quietly. As each word approaches the second style, its size and angle move toward the same destination. A missing setting is taken from the text that was there at the beginning. The page remembers that starting point, so another preview does not keep adding the previous change.";
        f=specimen("22 - One-sided style blend - mixed original sizes",originalPassage,[722,62,1090,W-62],18,44);
        f.parentStory.characters.itemByRange(0,100).pointSize=24;
        apply(f,{property:"styleBlend",mode:"word",target:"letters",styleA:originalA.id,styleB:originalB.id,min:0,max:100,missingStyle:"original"});
        section("23","Reopen the whole sequence","Kept Character-style blend, then Tracking / Word / Linear\rBlend: A to B, 0 to 100%. Tracking: 0 to 80. Both stages are saved with this frame.",1132);
        f=specimen("23 - Saved setup - character-style blend then tracking","A remembered curve can return to the page. Close the dialog, change a source character style, and open this frame again. Its saved setup loads with preview off. Reapply reads the new endpoint values and calculates the whole sequence from its original baseline. The words can change without losing the instructions that brought them here.",[1240,62,1480,W-62],24,44);
        applyStack(f,[{property:"styleBlend",mode:"word",target:"letters",styleA:blendA.id,styleB:blendB.id,min:0,max:100,missingStyle:"original"},{property:"tracking",mode:"word",target:"letters",min:0,max:80}]);
        box("Page 5 - footer rule",[1538,48,1538.5,W-48],rule,ground);
        text("Page 5 - footer reopen label","OPEN AGAIN",[1553,48,1572,48+cw],st.eye);
        text("Page 5 - footer reopen","Select the same frame and run the script. Saved setup loaded identifies its settings. Preview and Reapply update the document explicitly.",[1578,48,1630,48+cw],st.foot);
        text("Page 5 - footer baseline label","REAPPLY FROM THE START",[1553,48+cw+gap,1572,48+2*cw+gap],st.eye);
        text("Page 5 - footer baseline","The full stack restores its previous baseline first. Source styles are reread; previews do not accumulate earlier values. Cancel restores the committed appearance.",[1578,48+cw+gap,1630,48+2*cw+gap],st.foot);
        text("Page 5 - footer forget label","FORGET, KEEP THE APPEARANCE",[1553,48+2*(cw+gap),1572,W-48],st.eye);
        text("Page 5 - footer forget","Forget saved setup adopts the current formatting, breaks and shape. It stops recall, leaves the appearance in place, and has its own Undo step.",[1578,48+2*(cw+gap),1630,W-48],st.foot);
        text("Page 5 - repository","github.com/jahnDOTkoutrios/indesign-tracking-ramp   /   v8.0.0   /   Original endpoints and saved property stacks",[1650,48,1670,W-48],st.note);
        doc.recompose();
        for(var i=0;i<allText.length;i++){
            var tf=allText[i];
            if(tf.overflows&&!tf.extractLabel("TrackingRamp.guide.expectedOverset"))log("OVERSET "+tf.name);
        }
        doc.metadataPreferences.documentTitle="Fading, by degrees. - Tracking Ramp visual guide";
        doc.metadataPreferences.description="Five editable A2 specimen sheets demonstrating Tracking Ramp 8 text curves, metrics, scopes, frame contours, character-style blends, original-text endpoints and saved setups. Generated with the actual script engine.";
        ground.locked=true;labels.locked=true;doc.activeLayer=examples;
        var indd=File(folder.fsName+"/Tracking Ramp - Visual Guide.indd");doc.save(indd);
        doc.exportFile(ExportFormat.INDESIGN_MARKUP,File(folder.fsName+"/Tracking Ramp - Visual Guide.idml"),false);
        var pdf=File(folder.fsName+"/Tracking Ramp - Visual Guide.pdf");
        var oldPdf={pageRange:app.pdfExportPreferences.pageRange,viewPDF:app.pdfExportPreferences.viewPDF,exportReaderSpreads:app.pdfExportPreferences.exportReaderSpreads,cropMarks:app.pdfExportPreferences.cropMarks,bleedMarks:app.pdfExportPreferences.bleedMarks};
        try {app.pdfExportPreferences.properties={pageRange:PageRange.ALL_PAGES,viewPDF:false,exportReaderSpreads:false,cropMarks:false,bleedMarks:false};doc.exportFile(ExportFormat.PDF_TYPE,pdf,false);}
        finally{app.pdfExportPreferences.properties=oldPdf;}
        app.select(NothingEnum.NOTHING);
        try{doc.layoutWindows[0].zoom(ZoomOptions.FIT_PAGE);}catch(_){}
        log("FONTS "+sans.name+" | "+serif.name+" | "+variable.name+" / "+weight.name);
        log("SAVED "+indd.name+" | "+pdf.name+" | "+W+" x "+H+" pt");
        log("DONE");
    } catch(e){log("FAIL "+e.message+" line "+e.line);alert("Visual guide: "+e.message);}
    finally{app.scriptPreferences.measurementUnit=oldUnit;}
})();
