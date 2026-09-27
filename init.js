/*
 *  Material 3 theme for ruTorrent 5.x
 *  Copyright (C) 2026 Material3 theme contributors
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version. See the LICENSE file for details.
 *
 *  SPDX-License-Identifier: GPL-3.0-or-later
 *
 *  Icons: Material Icons by Google (Apache License 2.0)
 *  Font:  Roboto by Google (SIL Open Font License 1.1)
 */

// Default color scheme for users who have not picked one yet: 'auto' follows
// the operating system setting, 'light' or 'dark' force a scheme. Every user
// can change it under Settings > General or with the toolbar button.
plugin.md3Scheme = 'auto';

// RGBackground only understands hex and rgb(), so the colors that the core
// computes in JavaScript are mirrored here from the tokens in style.css.
plugin.md3Palettes = {
	light: {
		progressStart: "#d1e4ff", progressEnd: "#b7f397",
		diskStart: "#b7f397", diskEnd: "#ffdad6",
		cpuStart: "#386a20", cpuEnd: "#ba1a1a",
		graphDown: "#0061a4", graphUp: "#386a20"
	},
	dark: {
		progressStart: "#00497d", progressEnd: "#1f5108",
		diskStart: "#1f5108", diskEnd: "#93000a",
		cpuStart: "#9cd67d", cpuEnd: "#ffb4ab",
		graphDown: "#9ecaff", graphUp: "#9cd67d"
	}
};

plugin.md3Query = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

// The user's choice is kept in the core's per-user settings (synced across
// browsers) and cached in localStorage, so the first paint is already right
// before the settings have arrived from the server. "auto" cannot be stored:
// theWebUI.addSettings() turns the values "auto", "on" and "true" into 1.
plugin.md3Choices = ["system", "light", "dark"];
plugin.md3SettingKey = "webui.md3.scheme";
plugin.md3StorageKey = "md3-scheme";

plugin.md3Normalize = function(value)
{
	if(value === "auto")
		return("system");
	return((plugin.md3Choices.indexOf(value) >= 0) ? value : null);
}

plugin.md3ReadCache = function()
{
	try { return(plugin.md3Normalize(window.localStorage[plugin.md3StorageKey])); }
	catch(e) { return(null); }
}

plugin.md3WriteCache = function(choice)
{
	try { window.localStorage[plugin.md3StorageKey] = choice; }
	catch(e) {}
}

plugin.md3Choice =
	plugin.md3Normalize(theWebUI.settings[plugin.md3SettingKey]) ||
	plugin.md3ReadCache() ||
	plugin.md3Normalize(plugin.md3Scheme) ||
	"system";
// The settings dialog only saves keys that already exist in theWebUI.settings.
if(!plugin.md3Normalize(theWebUI.settings[plugin.md3SettingKey]))
	theWebUI.settings[plugin.md3SettingKey] = plugin.md3Choice;

plugin.md3IsDark = function()
{
	if(this.md3Choice === "dark")
		return(true);
	if(this.md3Choice === "light")
		return(false);
	return(!!(this.md3Query && this.md3Query.matches));
}

plugin.md3ApplyScheme = function()
{
	const dark = this.md3IsDark();
	document.documentElement.setAttribute("data-md-scheme", dark ? "dark" : "light");
	// The theme plugin marks every unknown theme as dark; correct the hint so
	// the loading screen of the next page load matches the chosen scheme.
	if(typeof setThemeHint === "function")
		setThemeHint(dark);
	this.md3Colors = this.md3Palettes[dark ? "dark" : "light"];
}

plugin.md3ApplyPluginColors = function()
{
	const colors = plugin.md3Colors;
	$.each({ diskspace: "disk", quotaspace: "disk", cpuload: "cpu" }, function(name, kind)
	{
		const plg = thePlugins.get(name);
		if(plg && plg.enabled)
		{
			plg.prgStartColor = new RGBackground(colors[kind + "Start"]);
			plg.prgEndColor = new RGBackground(colors[kind + "End"]);
		}
	});
}

plugin.md3ApplyTableColors = function(table)
{
	table.prgStartColor = new RGBackground(plugin.md3Colors.progressStart);
	table.prgEndColor = new RGBackground(plugin.md3Colors.progressEnd);
}

plugin.md3ApplyGraphColors = function(graph)
{
	if(graph && graph.down && graph.up)
	{
		graph.down.color = plugin.md3Colors.graphDown;
		graph.up.color = plugin.md3Colors.graphUp;
	}
}

plugin.md3ApplyScheme();

plugin.md3TableCreate = dxSTable.prototype.create;
dxSTable.prototype.create = function(ele, styles, aName)
{
	plugin.md3TableCreate.call(this, ele, styles, aName);
	plugin.md3ApplyTableColors(this);
}

if(theWebUI.speedGraph)
{
	plugin.md3GraphCreate = theWebUI.speedGraph.create;
	theWebUI.speedGraph.create = function()
	{
		const ret = plugin.md3GraphCreate.apply(this, arguments);
		plugin.md3ApplyGraphColors(this);
		return(ret);
	}
}

// Directory browser (_getdir): keep the list glued to its input field while it
// is open and let it grow to fit long directory names. The dialog manager
// re-centers a dialog whenever its size changes (e.g. when the browse button
// switches from "..." to "X"), which leaves the list behind at the old spot.
// Frames are matched to their field by id ("<field>_frame"), so this does not
// depend on the internals of the _getdir plugin.
plugin.md3FollowFrame = function(frame)
{
	const edit = document.getElementById(frame.id.replace(/_frame$/, ""));
	if(!edit || frame.md3Following)
		return;
	frame.md3Following = true;
	const step = function()
	{
		if(!frame.isConnected || !edit.isConnected || (getComputedStyle(frame).display === "none"))
		{
			frame.md3Following = false;
			return;
		}
		const r = edit.getBoundingClientRect();
		// Position relative to whatever box the frame is laid out in.
		const parent = frame.offsetParent || document.body;
		const p = parent.getBoundingClientRect();
		frame.style.left = (r.left - p.left - parent.clientLeft + parent.scrollLeft) + "px";
		frame.style.top = (r.bottom - p.top - parent.clientTop + parent.scrollTop + 4) + "px";
		frame.style.width = "max-content";
		frame.style.minWidth = r.width + "px";
		frame.style.maxWidth = Math.max(r.width, Math.min(720, window.innerWidth - r.left - 16)) + "px";
		window.requestAnimationFrame(step);
	};
	step();
}

plugin.md3WatchFrames = function()
{
	const check = function(el)
	{
		if(el.classList && el.classList.contains("browseFrame") && (getComputedStyle(el).display !== "none"))
			plugin.md3FollowFrame(el);
	};
	new MutationObserver(function(mutations)
	{
		for(const m of mutations)
		{
			check(m.target);
			if(m.addedNodes)
				m.addedNodes.forEach(check);
		}
	}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "open", "class"] });
}
plugin.md3WatchFrames();

// The meter plugins set their own colors in init(), which may run after
// allDone; re-apply the theme colors on every update instead of only once.
plugin.md3WrapMeter = function(name)
{
	const plg = thePlugins.get(name);
	if(!plg || !plg.enabled || ($type(plg.setValue) !== "function") || plg.setValue.md3Wrapped)
		return;
	const setValue = plg.setValue;
	plg.setValue = function()
	{
		plugin.md3ApplyPluginColors();
		return(setValue.apply(this, arguments));
	};
	plg.setValue.md3Wrapped = true;
}

plugin.md3AllDone = plugin.allDone;
plugin.allDone = function()
{
	plugin.md3AllDone.apply(this, arguments);
	plugin.md3ApplyPluginColors();
	plugin.md3WrapMeter("diskspace");
	plugin.md3WrapMeter("quotaspace");
	plugin.md3RecolorDisk();
}

// The disk meter keeps the color of its last update, which may have been
// drawn with the plugin's own light colors before the theme took over.
plugin.md3RecolorDisk = function()
{
	const disk = $("#meter-disk-value")[0];
	if(!disk)
		return;
	const percent = parseFloat(disk.style.width) || 0;
	disk.style.backgroundColor = new RGBackground().setGradient(
		new RGBackground(plugin.md3Colors.diskStart),
		new RGBackground(plugin.md3Colors.diskEnd),
		percent).getColor();
}

// Re-apply every JavaScript computed color after the scheme has changed.
plugin.md3Recolor = function()
{
	plugin.md3ApplyScheme();
	plugin.md3ApplyPluginColors();
	$.each(theWebUI.tables, function(ndx, table)
	{
		if(table.obj)
			plugin.md3ApplyTableColors(table.obj);
	});
	// Rendered progress bars keep their inline color until their value changes,
	// which never happens for finished torrents, so recolor them in place.
	const start = new RGBackground(plugin.md3Colors.progressStart);
	const end = new RGBackground(plugin.md3Colors.progressEnd);
	$(".stable .meter-value").each(function()
	{
		const percent = parseFloat(this.style.width) || 0;
		this.style.backgroundColor = new RGBackground().setGradient(start, end, percent).getColor();
	});
	plugin.md3RecolorDisk();
	plugin.md3ApplyGraphColors(theWebUI.speedGraph);
	if(theWebUI.speedGraph && theWebUI.speedGraph.plot)
		theWebUI.speedGraph.draw();
}

// Follow a change of the system color scheme without a reload.
plugin.md3OnSystemChange = function()
{
	if(plugin.md3Choice === "system")
		plugin.md3Recolor();
}
if(plugin.md3Query)
{
	if(plugin.md3Query.addEventListener)
		plugin.md3Query.addEventListener("change", plugin.md3OnSystemChange);
	else if(plugin.md3Query.addListener)
		plugin.md3Query.addListener(plugin.md3OnSystemChange);
}

/*** Color scheme switch: settings select and toolbar button ***/

// The theme cannot ship language files of its own (they belong to the theme
// plugin), so the few labels it needs live here.
plugin.md3Strings = {
	en: { title: "Color scheme", system: "Automatic (system)", light: "Light", dark: "Dark" },
	de: { title: "Farbschema", system: "Automatisch (System)", light: "Hell", dark: "Dunkel" },
	fr: { title: "Mode d'affichage", system: "Automatique (système)", light: "Clair", dark: "Sombre" },
	es: { title: "Esquema de color", system: "Automático (sistema)", light: "Claro", dark: "Oscuro" },
	it: { title: "Schema colori", system: "Automatico (sistema)", light: "Chiaro", dark: "Scuro" },
	nl: { title: "Kleurenschema", system: "Automatisch (systeem)", light: "Licht", dark: "Donker" },
	pl: { title: "Schemat kolorów", system: "Automatycznie (system)", light: "Jasny", dark: "Ciemny" },
	ru: { title: "Цветовая схема", system: "Автоматически (система)", light: "Светлая", dark: "Тёмная" }
};

plugin.md3Text = function(key)
{
	const lang = String((typeof GetActiveLanguage === "function") ? GetActiveLanguage() : "en").slice(0, 2).toLowerCase();
	return((plugin.md3Strings[lang] || plugin.md3Strings.en)[key]);
}

plugin.md3NextChoice = { system: "light", light: "dark", dark: "system" };

// Reflect the current choice in the toolbar button and the settings select.
plugin.md3UpdateControls = function()
{
	const label = plugin.md3Text("title") + ": " + plugin.md3Text(plugin.md3Choice);
	$("#md3scheme").attr("data-md-choice", plugin.md3Choice);
	$("#mnu_md3scheme").attr("title", label).children("span").text(label);
	const select = $$(plugin.md3SettingKey);
	if(select)
		select.value = plugin.md3Choice;
}

// Store the choice in the user's settings on the server. The stored settings
// are fetched and merged first, so that settings saved from another browser in
// the meantime are not overwritten (the mobile plugin does the same).
plugin.md3Persist = function(choice)
{
	if(!theWebUI.configured)
		return;
	theWebUI.requestWithoutTimeout("?action=getuisettings", function(stored)
	{
		if(stored)
			$.extend(theWebUI.settings, stored);
		theWebUI.settings[plugin.md3SettingKey] = choice;
		theWebUI.save();
	}, true);
}

plugin.md3SetChoice = function(choice, persist)
{
	choice = plugin.md3Normalize(choice);
	if(!choice)
		return;
	const changed = (choice !== plugin.md3Choice);
	plugin.md3Choice = choice;
	theWebUI.settings[plugin.md3SettingKey] = choice;
	plugin.md3WriteCache(choice);
	plugin.md3UpdateControls();
	if(changed)
		plugin.md3Recolor();
	if(persist)
		plugin.md3Persist(choice);
}

// The per-user settings usually arrive after this script has run; apply the
// stored choice as soon as they do (also when another browser changed it).
plugin.md3AddSettings = theWebUI.addSettings;
theWebUI.addSettings = function()
{
	const ret = plugin.md3AddSettings.apply(this, arguments);
	const stored = plugin.md3Normalize(theWebUI.settings[plugin.md3SettingKey]);
	if(stored)
		plugin.md3SetChoice(stored, false);
	else
		theWebUI.settings[plugin.md3SettingKey] = plugin.md3Choice;
	return(ret);
}

// The settings dialog saves the select itself (its id is the settings key);
// apply the new value once the dialog has been confirmed.
plugin.md3SetSettings = theWebUI.setSettings;
theWebUI.setSettings = function()
{
	const ret = plugin.md3SetSettings.apply(this, arguments);
	plugin.md3SetChoice(theWebUI.settings[plugin.md3SettingKey], false);
	return(ret);
}

// Add the select next to the theme select under Settings > General.
plugin.md3AddSchemeSelect = function()
{
	const theme = $$("webui.theme");
	if(!theme || $$(plugin.md3SettingKey))
		return;
	const select = $("<select>").attr({ id: plugin.md3SettingKey }).append(
		plugin.md3Choices.map((choice) => $("<option>").val(choice).text(plugin.md3Text(choice)))
	);
	$(theme).parent().after(
		$("<div>").addClass("col-6 col-md-3").append(
			$("<label>").attr({ for: plugin.md3SettingKey }).text(plugin.md3Text("title") + ": "),
		),
		$("<div>").addClass("col-6 col-md-3").append(select),
	);
	plugin.md3UpdateControls();
}

plugin.md3OnLangLoaded = plugin.onLangLoaded;
plugin.onLangLoaded = function()
{
	if($type(plugin.md3OnLangLoaded) === "function")
		plugin.md3OnLangLoaded.apply(this, arguments);
	plugin.md3AddSchemeSelect();
}

// Without rTorrent the core opens the settings without reloading them into
// the form, so set the select explicitly every time the dialog opens.
theDialogManager.addHandler("stg", "beforeShow", function()
{
	plugin.md3UpdateControls();
});

// Toolbar button: cycles Automatic -> Light -> Dark. It goes right after the
// settings button: without rTorrent the core removes whatever sits right before
// that button, expecting a separator (removeSeparatorFromToolbar("settings")).
plugin.md3AddToolbarButton = function()
{
	if($$("mnu_md3scheme"))
		return;
	plugin.addButtonToToolbar("md3scheme", plugin.md3Text("title"), function()
	{
		plugin.md3SetChoice(plugin.md3NextChoice[plugin.md3Choice], true);
		return(false);
	}, "help");
	const settings = $("#mnu_settings");
	if(settings.length)
		$("#mnu_md3scheme").insertAfter(settings);
	plugin.md3UpdateControls();
}
plugin.md3AddToolbarButton();
