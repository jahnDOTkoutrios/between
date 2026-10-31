#target "indesign"
/* Build the editable, one-page Tracking Ramp specimen using the actual v5 engine.
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
            var s={scope:0,mode:"word",restart:"never",target:"letters",property:"tracking",min:0,max:180,curve:"linear",power:2,width:22,steps:0,invert:false,points:[],smooth:true,axisName:"",colorA:ink.id,colorB:mist.id,strokeWidth:0.5,replace:true,clearTracking:false,metrics:false,lockLines:true,textEnabled:true};
            for(var k in extra)s[k]=extra[k];return s;
        }
        function apply(tf,extra) {
            app.select(tf); var s=settings(extra), target=api.resolveTarget();
            // Use the complete local story for semantic samples unless explicitly
            // demonstrating live frame scope. Line/frame units still exclude overset.
            if(!extra||extra.scope===undefined)s.scope=target.scopes.length-1;
            var session=new api.PreviewSession(target), result=session.preview(s);session.commit(s);
            if(s.metrics){for(var m=0;m<doc.textFrames.length;m++){if(doc.textFrames[m].extractLabel("TR3.metricsStory")===String(tf.parentStory.id)){doc.textFrames[m].locked=false;doc.textFrames[m].strokeColor=none;doc.textFrames[m].locked=true;}}}
            tf.insertLabel("TrackingRamp.guide.settings",api.encode(s));
            tf.parentStory.recompose();
            log(tf.name+" | "+result.units.length+" units | "+result.passes+" passes | "+(result.lockedBreaks||0)+" fixed breaks | overset="+tf.overflows);
            return result;
        }
        text("Guide - eyebrow","TRACKING RAMP 5  /  VISUAL GUIDE",[44,48,66,760],st.eye);
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
        c=card(3,"A bell in every line","Tracking / Word / Gaussian / 0 to 260\rRestart: Line / Fully justified / Metrics: on","5 pt numbers print in the gap below each text row.");
        f=specimen("03 - Justified line bells with printable metrics","The room keeps a softer record of us. Curtains lose their blue. Paper turns warm at the edges. Every line begins again, opening at its center and returning to quiet before the next breath.",[c.y-2,c.x,c.y+c.h-1,c.x+c.w],12.5,24,{justified:true});apply(f,{restart:"line",curve:"gaussian",max:260,metrics:true,scope:0});
        c=card(4,"Small, large, small","Font size / Character / Gaussian / 14 to 48 pt\rRestart: Word / Change: Both / Auto steps","The complete size curve starts again inside each word.");
        f=specimen("04 - Font size - character bells per word","fading\rfading\rfading",[c.y,c.x,c.y+c.h,c.x+c.w],30,51);apply(f,{property:"pointSize",mode:"character",restart:"word",target:"both",curve:"gaussian",min:14,max:48});
        c=card(5,"A rising memory","Baseline shift / Character / Sine / 0 to 14 pt\rRestart: Never / Change: Letters / Auto steps","The glyphs rise and fall. Leading stays at 48 pt.");
        f=specimen("05 - Baseline shift - sine 0-14 pt","What stays\rwhen light\rleaves?",[c.y+12,c.x,c.y+c.h,c.x+c.w],30,48);apply(f,{property:"baselineShift",mode:"character",curve:"sine",max:14});
        c=card(6,"Color, then begin again","Character color / Word / Linear / Ink to Mist\rRestart: Paragraph / Change: Both / Auto steps","Each paragraph repeats the same color transition.");
        f=specimen("06 - Character color - word ramp per paragraph","A letter fades from black to a quiet trace. Its message remains, even as the ink grows light.\rThe second memory begins in darkness, then follows the first toward the edge of sight.",[c.y,c.x,c.y+c.h,c.x+c.w],16,23);f.parentStory.texts[0].spaceAfter=10;apply(f,{property:"fillColor",restart:"paragraph",target:"both",max:100});
        c=card(7,"A sentence stretches","Horizontal scale / Word / Linear / 65 to 145%\rRestart: Sentence / Change: Both / Auto steps","Three sentences; three independent distributions.");
        f=specimen("07 - Horizontal scale - word ramp per sentence","The edges grow quiet.\rThe hours spread thin.\rThe colors drift away.",[c.y+5,c.x,c.y+c.h,c.x+c.w],25,48);apply(f,{property:"horizontalScale",restart:"sentence",target:"both",min:65,max:145});
        c=card(8,"Lean and drift","Skew: -20 to 20 degrees / Character / Linear\rRotation: -12 to 12 degrees / Character / Sine","Two separate targets; generous leading leaves room.");
        f=specimen("08A - Skew - character linear minus20-plus20","a leaning memory",[c.y+8,c.x,c.y+70,c.x+c.w],28,45);apply(f,{property:"skew",mode:"character",min:-20,max:20});
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
        text("Footer - reapply","REAPPLY A CURVE",[1553,48+cw+gap,1572,48+2*cw+gap],st.eye);
        text("Footer - reapply instructions","Keep Replace previous effect on to start from the saved baseline. Example 03 may use managed soft breaks to preserve exact line curves.",[1578,48+cw+gap,1630,48+2*cw+gap],st.foot);
        text("Footer - compare","READ THE RESULTS",[1553,48+2*(cw+gap),1572,W-48],st.eye);
        text("Footer - compare instructions","Auto steps samples every eligible unit. Frame/line groups exclude overset. Examples 11 and 12 intentionally contain longer stories.",[1578,48+2*(cw+gap),1630,W-48],st.foot);
        text("Footer - repository","github.com/jahnDOTkoutrios/indesign-tracking-ramp   /   v5.0.0   /   Editable specimens, actual applied values",[1650,48,1670,W-48],st.note);
        doc.recompose();
        for(var i=0;i<allText.length;i++){
            var tf=allText[i];
            if(tf.overflows&&!tf.extractLabel("TrackingRamp.guide.expectedOverset"))log("OVERSET "+tf.name);
        }
        doc.metadataPreferences.documentTitle="Fading, by degrees. - Tracking Ramp visual guide";
        doc.metadataPreferences.description="One editable A2 specimen sheet demonstrating Tracking Ramp 5 text curves, metrics, scopes, and frame contours. Generated with the actual script engine.";
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
