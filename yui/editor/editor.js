// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Javascript for tool_behateditor
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

YUI.add('moodle-tool_behateditor-editor', function (Y) {

M.tool_behateditor = {

/** @var string URL for AJAX requests */
api : null,

stepsdefinitions : {},

textselectors : {},

selectors : {},

search_dlg : null,

init : function(api) {
    M.tool_behateditor.api = api;
    M.tool_behateditor.load_steps_definitions(0);
    Y.one('#behateditor_searchform').on('submit', function(e) {e.preventDefault();});
    var searchword = Y.one('#behateditor_searchword');
    searchword.on('change', M.tool_behateditor.refresh_search_results);
    searchword.on('keydown', M.tool_behateditor.refresh_search_results);
    Y.all('#behateditor_featureedit .featureedit .featuretab').on(
        'click', M.tool_behateditor.click_feature_editor_tab);
    Y.one('#behateditor_featureedit .content-editor').delegate(
            'click',
            function(e) {
                var el = e.currentTarget.ancestor('fieldset');
                if (el.hasClass('collapsed')) {
                    el.removeClass('collapsed');
                } else {
                    el.addClass('collapsed');
                }
            },
            'fieldset legend.ftoggler');
    // Toggle between step source and editor.
    Y.one('#behateditor_featureedit').delegate(
            'click', M.tool_behateditor.click_feature_editor_stepcontrol,
            '.content-editor .step .stepcontrols .stepaction');
    // Add new step before current.
    Y.one('#behateditor_featureedit').delegate(
            'click', M.tool_behateditor.click_feature_editor_addstep,
            '.content-editor .step .stepcontrols .addstep');
    // Delete current step.
    Y.one('#behateditor_featureedit').delegate(
            'click', M.tool_behateditor.click_feature_editor_deletestep,
            '.content-editor .step .stepcontrols .deletestep');
    // Change steptype (Given/When/Then/And).
    Y.one('#behateditor_featureedit').delegate(
            'click', M.tool_behateditor.click_feature_editor_steptype,
            '.content-editor .step .stepeditor .steptype span');
    // Pick the result from step definition search.
    Y.one('#behateditor_searchoutput').delegate(
        'click', M.tool_behateditor.click_searchoutput_step,
        '.step');
},

refresh_search_results : function() {
    var api = M.tool_behateditor.api,
            searchword = Y.one('#behateditor_searchword'),
            keywords = searchword.get('value');
    if (!keywords) {
        var hashes = [];
        for (var key in M.tool_behateditor.stepsdefinitions) {
            hashes.push(key);
        }
        M.tool_behateditor.display_search_results(hashes);
    } else {
        Y.io(api,{
            method: 'POST',
            on: {
                complete: function(id, o, p) {
                    data = Y.JSON.parse(o.responseText);
                    M.tool_behateditor.display_search_results(data.hashes);
                }
            },
            data: {
                action : 'search',
                keyword : keywords
            }
        });
    }
},

click_feature_editor_tab : function(e) {
    var container = Y.one('#behateditor_featureedit .featureedit'),
            newmode;
    if (e.currentTarget.hasClass('tab-editor')) {
        newmode = 'mode-editor';
    } else if (e.currentTarget.hasClass('tab-source')) {
        newmode = 'mode-source';
    } else {
        return;
    }
    if (container.hasClass(newmode)) {
        console.log('You are already on the tab '+newmode);
        return;
    }
    container.removeClass('mode-editor');
    container.removeClass('mode-source');
    container.addClass('mode-loading');
    if (newmode === 'mode-editor') {
        M.tool_behateditor.convert_from_source_to_editor();
    } else {
        M.tool_behateditor.convert_from_editor_to_source();
    }
    container.removeClass('mode-loading');
    container.addClass(newmode);
},

convert_from_source_to_editor : function() {
    var source = Y.one('#behateditor_featuresource').get('value'),
            chunks = source.trim().split(/\n[\t\s]*\n/), i, chunkheader, fieldset, chunkcontents,
            targetdiv = Y.one('#behateditor_featureedit .content .content-editor'),
            nextline, steps;
    targetdiv.setContent('');
    for (i in chunks) {
        fieldset = Y.Node.create('<fieldset class="collapsible"></fieldset>');
        chunkcontents = Y.Node.create('<div class="fcontainer clearfix"></div>');
        if (i > 0) {
            // To create an empty line between chunks on re-parsing.
            chunkcontents.append('<div class="stepsheader"><textarea></textarea></div>');
        }
        lines = chunks[i].replace(/\s+\n/g,"\n").replace(/^\n+/,'').replace('/\n+$/','').split(/\n/);
        if (lines.length > 0 && (lines[0].match(/^  Background:/) || lines[0].match(/^  Scenario:/))) {
            chunkheader = lines.shift();
            chunkcontents.append('<div class="stepsheader"><textarea rows="1" cols="60">'+chunkheader+'</textarea></div>');
            steps = [];
            while (lines.length > 0) {
                nextline = lines.shift();
                if (nextline.match(/^     /) && steps.length > 0) {
                    steps[steps.length-1] += "\n" + nextline;
                } else {
                    steps.push(nextline);
                }
            }
            for (j in steps) {
                chunkcontents.append(M.tool_behateditor.feature_step_node(steps[j]));
            }
            chunkcontents.append(M.tool_behateditor.feature_step_node(null, true));
            fieldset.addClass('featuresteps');
        } else {
            if (i > 0) {
                chunkheader = 'Unrecognised block';
                fieldset.addClass('unrecognised');
            } else {
                chunkheader = 'Header';
                fieldset.addClass('featureheader');
            }
            fieldset.addClass('collapsed');
            chunkcontents.append('<textarea rows="'+chunks[i].split(/\n/).length+'" cols="60">'+chunks[i]+'</textarea>');
        }
        fieldset.append('<legend class="ftoggler">'+chunkheader+'</legend>');
        fieldset.append(chunkcontents);
        targetdiv.append(fieldset);
    }
    targetdiv.all('.step .stepcontrols .stepaction-editor').each(function(el) {
        M.tool_behateditor.click_feature_editor_stepcontrol({currentTarget: el});
    });
},

convert_from_editor_to_source : function() {
    var sourcecode = Y.one('#behateditor_featuresource');
    Y.all('#behateditor_featureedit .content .content-editor .step.stepmode-editor').
            each(function(stepel){
        M.tool_behateditor.make_step_definition(stepel);
    });
    str = '';
    Y.all('#behateditor_featureedit .content .content-editor textarea').each(function(el) {
        str += el.get('value').replace(/[ \n]+$/, '') + "\n";
    });
    sourcecode.set('value', str);
},

make_step_definition : function(stepel) {
    var src = stepel.one('.stepeditor'),
            target = stepel.one('.stepsource textarea'),
            hash = src.getAttribute('data-hash'),
            steptype = src.one('.steptype .cursteptype').getAttribute('data-steptype');
    var str = M.tool_behateditor.stepsdefinitions[hash]['stepregex'];
    str = str.replace(/"([A-Z][A-Z|0-9|_]*)"/g, function(fullstring) {
        return '"' + src.one('span[data-param='+fullstring+'] input,span[data-param='+fullstring+'] select').get('value') + '"';
    });
    target.set('value', '    '+steptype+' '+str);
},

parse_step_definition : function(stepel) {
    var src = stepel.one('.stepsource textarea').get('value').replace(/[\s\n]+$/,'').replace(/^\n+/,''),
            lines = src.split(/\n/), firstline, hash = '', firstword, step, regex, foundmatches;
    if (!lines.length) {
        console.log('Can not parse empty step');
        return false;
    }
    if (lines.length > 1) {
        console.log('Can not parse multiline step (TODO)');
        return false;
        // TODO tables!
    }
    firstline = lines.shift().trim();
    firstword = firstline.match(/^(And|Given|Then|When) /);
    if (!firstword) {
        console.log('Can not parse step: first word must be And|Given|Then|When');
        return false;
    }
    firstword = firstword[1];
    firstline = firstline.replace(/^\w+ /,'');
//console.log('matching ['+firstline+']');
    for (i in M.tool_behateditor.stepsdefinitions) {
        regex = M.tool_behateditor.stepsdefinitions[i]['stepregex'];
        regex = '^'+regex.replace(/"[A-Z][A-Z|0-9|_]*"/g, '"((?:[^"]|\\\\")*)"')+'$';
        var matches = firstline.match(new RegExp(regex, ''));
        if (matches) {
            foundmatches = matches;
//console.log('-- '+regex)
//console.log('YES')
            if (hash === '') {
                hash = i;
            } else {
                // More than one match.
                console.log('Can not parse step: More than one definition match');
                return false;
            }
        }
    }
    if (hash === '') {
        console.log('Can not parse step: No matching definition found');
        return false;
    }
    step = M.tool_behateditor.stepsdefinitions[hash];

    var str = step['stepregex'];
//console.log(foundmatches)
    foundmatches.shift();
    str = str.replace(/"([A-Z][A-Z|0-9|_]*)"/g, '"<span data-param="$1" data-type="UNKNOWN"></span>"');
    var stepregex = Y.Node.create('<span class="stepregex"></span>');
    stepregex.append(str);
    stepregex.all('span').each(function(el){
        var value = foundmatches.shift();
        var param = el.getAttribute('data-param').replace(/^"/,'').replace(/"$/,'');
        if (param.match(/^SELECTOR\d?_STRING$/)) {
            el.setAttribute('data-type', 'SELECTOR_STRING');
            el.append('<select size="1" ></select>');
            for (var i in M.tool_behateditor.selectors) {
                var o = M.tool_behateditor.selectors[i];
                if (o === value) {
                    el.one('select').append('<option value="'+o+'" selected>'+o+'</option>');
                } else {
                    el.one('select').append('<option value="'+o+'">'+o+'</option>');
                }
            }
        } else if (param.match(/^TEXT_SELECTOR\d?_STRING$/)) {
            el.setAttribute('data-type', 'TEXT_SELECTOR_STRING');
            el.append('<select size="1" ></select>');
            for (var i in M.tool_behateditor.textselectors) {
                var o = M.tool_behateditor.textselectors[i];
                if (o === value) {
                    el.one('select').append('<option value="'+o+'" selected>'+o+'</option>');
                } else {
                    el.one('select').append('<option value="'+o+'">'+o+'</option>');
                }
            }
        } else if (param.match(/_NUMBER$/)) {
            el.setAttribute('data-type', 'NUMBER');
            el.append('<input type="text" size="5" />');
            el.one('input').setAttribute('value', value);
        } else {
            if (el.getAttribute('data-param').match(/_STRING$/)) {
                el.setAttribute('data-type', 'STRING');
            }
            el.append('<input type="text" size="20" />');
            el.one('input').setAttribute('value', value);
        }
    });

    var editor = stepel.one('.stepeditor');
    editor.setContent('');
    editor.setAttribute('data-hash', hash);
    var steptype = Y.Node.create('<span class="steptype"></span>');
    Y.Array.each(['Given', 'When', 'Then', 'And'],
        function(n) {steptype.append('<span data-steptype="'+n+'"></span>');});
    M.tool_behateditor.click_feature_editor_steptype({currentTarget: steptype.one('[data-steptype='+firstword+']')});
    //steptype.addClass('cursteptype-'+firstword);
    editor.append(steptype);
    editor.append(stepregex);
    return true;
},

click_feature_editor_steptype : function(e) {
    var steptypeel = e.currentTarget.ancestor('.steptype'),
            newtype = e.currentTarget.getAttribute('data-steptype');
    steptypeel.all('span').removeClass('cursteptype');
    steptypeel.all('span').each(function(el) {
        el.setContent(el.getAttribute('data-steptype').substr(0,1));
    });
    e.currentTarget.setContent(newtype);
    e.currentTarget.addClass('cursteptype');
},

click_feature_editor_stepcontrol : function(e) {
    var stepel = e.currentTarget.ancestor('.step'), newclass;
    if (e.currentTarget.hasClass('stepaction-source')) {
        newclass = 'stepmode-source';
    } else if (e.currentTarget.hasClass('stepaction-editor')) {
        newclass = 'stepmode-editor';
    } else {
        return;
    }
    if (stepel.hasClass(newclass)) {
        console.log('The current mode for this step is already '+newclass);
        return;
    }
    if (newclass === 'stepmode-editor') {
        if (!M.tool_behateditor.parse_step_definition(stepel)) {
            newclass = 'stepmode-source stepmode-editor-failed';
        }
    } else {
        M.tool_behateditor.make_step_definition(stepel);
    }
    stepel.removeClass('stepmode-source');
    stepel.removeClass('stepmode-editor');
    stepel.removeClass('stepmode-editor-failed');
    stepel.addClass(newclass);
},

click_feature_editor_deletestep : function(e) {
    var node, step = e.currentTarget.ancestor('.step');
    step.remove();
},

click_feature_editor_addstep : function(e) {
    var insertbeforestep = e.currentTarget.ancestor('.step');
    // Remove existing temp node.
    Y.all('#behateditor_featureedit .content-editor .tempaddstep').remove();
    var tempnode = Y.Node.create('<div class="tempaddstep"></div>');
    insertbeforestep.get('parentNode').insertBefore(tempnode, insertbeforestep);
    M.tool_behateditor.open_addstep_dialogue();
},

open_addstep_dialogue : function() {
    Y.one('#behateditor_searchform').removeClass('hiddenifjs');

    if (!M.tool_behateditor.search_dlg) {
        M.tool_behateditor.search_dlg = new M.core.dialogue({
            draggable    : true,
            bodyContent  : Y.one('#behateditor_searchform'),
            headerContent: 'Search step definition',
            width        : '700px',
            height       : '300px',
            modal        : true,
            visible      : false
        });
        /* M.tool_behateditor.search_dlg.after("visibleChange", function(e) {
            var panel = M.tool_behateditor.search_dlg;
            if (!panel.get('visible')) {
                // This does not work because it gets removed too early.
                Y.all('#behateditor_featureedit .content-editor .tempaddstep').remove();
            }
        }); */
    }
    M.tool_behateditor.search_dlg.show();
    M.tool_behateditor.search_dlg.align('#behateditor_featureedit .content-editor .tempaddstep',
        [Y.WidgetPositionAlign.TL, Y.WidgetPositionAlign.BL]);
    Y.one('#behateditor_searchword').focus();
    Y.one('#behateditor_searchword').select();
},

close_addstep_dialogue : function(hash) {
    var tempnode = Y.one('#behateditor_featureedit .content-editor .tempaddstep');
    if (M.tool_behateditor.search_dlg) {
        M.tool_behateditor.search_dlg.hide();
    }
    if (tempnode === null) {
        console.log('Add step target is lost');
        return;
    }
    if (M.tool_behateditor.stepsdefinitions[hash]) {
        var src = '    ' + M.tool_behateditor.stepsdefinitions[hash]['steptype'] + ' ' +
                M.tool_behateditor.stepsdefinitions[hash]['stepregex'];
        var node = M.tool_behateditor.feature_step_node(src);
        tempnode.get('parentNode').insertBefore(node, tempnode);
        M.tool_behateditor.click_feature_editor_stepcontrol({currentTarget: node.one('.stepcontrols .stepaction-editor')});
    }
    tempnode.remove();
},

click_searchoutput_step : function(e) {
    var hash = e.currentTarget.getAttribute('data-hash').replace(/"/g,'');
    M.tool_behateditor.close_addstep_dialogue(hash);
},

feature_step_node : function(src, lastnode) {
    var node;
    if (lastnode) {
        node = Y.Node.create('<div class="step laststep clearfix"></div>');
        node.append('<div class="stepcontrols">'+
                '<span class="addstep">Add</span>'+
                '</div>');
    } else {
        node = Y.Node.create('<div class="step stepmode-source clearfix"></div>');
        node.append('<div class="stepcontrols">'+
                '<span class="addstep">Add</span>'+
                '<span class="deletestep">Del</span>'+
                '<span class="stepaction stepaction-editor">Edit</span>'+
                '<span class="stepaction stepaction-source">Src</span>'+
                '</div>');
        node.append('<div class="stepsource"><textarea rows="'+src.split(/\n/).length+
                    '" cols="60">'+src+'</textarea></div>');
        node.append('<div class="stepeditor"></div>');
    }
    return node;
},

display_search_results : function(hashes) {
    var i, step,
            container = Y.one('#behateditor_searchoutput');
    container.setContent('');
    container.addClass('empty');
    for (i in hashes) {
        step = M.tool_behateditor.stepsdefinitions[hashes[i]];
        container.append('<div class="step" data-hash="'+hashes[i]+
                '"><div class="stepdescription">'+step['stepdescription']+
                '</div><div class="stepcontent"><span class="steptype">'+step['steptype']+
                ' </span><span class="stepregex">'+step['stepregex']+'</span></div></div>');
        container.removeClass('empty');
    }
},

load_steps_definitions : function(force) {
    var api = M.tool_behateditor.api;
    Y.io(api,{
        method: 'GET',
        on: {
            complete: function(id, o, p) {
                data = Y.JSON.parse(o.responseText);
                M.tool_behateditor.stepsdefinitions = data.stepsdefinitions;
                M.tool_behateditor.textselectors = data.textselectors;
                M.tool_behateditor.selectors = data.selectors;
                M.tool_behateditor.refresh_search_results();
            }
        },
        data: {
            action : 'stepsdef',
            force : force
        }
    });
}

};

}, '@VERSION@', { requires: ['base', 'io-base', 'node', 'event-delegate', 'json-parse', 'overlay'] });