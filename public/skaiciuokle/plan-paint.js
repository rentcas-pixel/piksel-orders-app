/* First paint for Planas — table + grid before app.js parses. */
(function () {
  var SCREENS = [
    [1,"Panorama","Vilnius","Statinis","0n331qw8r35uiek"],
    [2,"Laisvės kelias","Vilnius","Statinis","km2b43p066mhki3"],
    [3,"Narbuto žiedas","Vilnius","Statinis","6c57a5845lt0v0e"],
    [4,"Justiniškės","Vilnius","Video","59x21n5ytqz55l9"],
    [5,"Kareivių","Vilnius","Statinis","tl6qpefh1ssrxus"],
    [6,"Compensa","Vilnius","Video","z4kvcyc17l4a3w1"],
    [7,"Mada","Vilnius","Video","9e9d2oezptn5ld7"],
    [8,"Senukai","Vilnius","Video","odhc206dr1lv034"],
    [9,"Nordika","Vilnius","Video","4bbocc7dqwc9e4i"],
    [10,"Kalvarijų","Vilnius","Video","3oic7ccmk8tqand"],
    [11,"Ukmergės","Vilnius","Statinis","g690tqd81g8j50v"],
    [12,"Spaudos rūmai","Vilnius","Statinis","5lho8d3ziq9ovk1"],
    [13,"Outlet","Vilnius","Video","y389fa8ii71w02m"],
    [14,"Pašilaičiai","Vilnius","Statinis","tbqfx89v3bcxo7c"],
    [15,"Pilaitė","Vilnius","Statinis","qj7fbnsq4528au3"],
    [16,"Ozas","Vilnius","Statinis","dsv1z5klq5nthwu"],
    [17,"Konstitucijos","Vilnius","Viadukas","2lba7l2da7r93z0"],
    [18,"Narbuto","Vilnius","Viadukas","774t3lv97c6v9qq"],
    [19,"Pedagoginis","Vilnius","Viadukas","xl6z0o5z6p7hbal"],
    [20,"Lazdynai","Vilnius","Viadukas","x5cgb8l7070xwho"],
    [21,"Jasinskio","Vilnius","Viadukas","yc846lvk92q4611"],
    [22,"Geležinio Vilko","Vilnius","Viadukas","371fh66b00ty0uk"],
    [23,"Šeškinės","Vilnius","Viadukas","8ovh47ucsc1xz37"],
    [24,"Ateities","Vilnius","Viadukas","641rcg36nnq3i9x"],
    [25,"Akropolis △","Vilnius","Statinis","qxvlabdu18wk14p"],
    [26,"Urmas","Kaunas","Video","p8gz1sx5la3bgwl"],
    [27,"Taikos pr.","Kaunas","Video","bltbap72zbpvctl"],
    [28,"Pramonės","Kaunas","Video","hj5ny7q0kg8ob8m"],
    [29,"Centras","Kaunas","Video","z6msjm9k2h2fxu6"],
    [30,"Girstučio","Kaunas","Video","fy2jjyol2qqousk"],
    [31,"Molas","Kaunas","Video","yqbd96sxid1orra"],
    [32,"Akropolis","Kaunas","Video","tcmax2p88xj03qx"],
    [33,"Vytauto pr.","Kaunas","Video","10kniw3waz844s2"],
    [34,"Mega","Kaunas","Video","d0jkbmhurtmccj8"],
    [35,"Į Senamiestį","Kaunas","Video","xta534d3j343uzo"],
    [36,"Iš Senamiesčio","Kaunas","Video","9wiob10x522h07i"],
    [37,"Žemaičių plentas","Kaunas","Video","bk0z8gd52347gni"],
    [38,"Šilainiai","Kaunas","Video","9f7vl47t3g88q52"],
    [39,"Varnių","Kaunas","Video","8z1542zn3rz5604"],
    [40,"Baltijos","Klaipėda","Video","xo277if08fzzm13"],
    [41,"Centras","Klaipėda","Video","262zil0965t4rh1"],
    [42,"Šilutės","Klaipėda","Video","cgh8utxq0mixy3m"],
    [43,"Dubijos","Šiauliai","Video","d9ve1athq5al5is"],
    [44,"Rūta","Šiauliai","Video","ofdknx7qoj2t27u"],
    [45,"Ryo","Panevėžys","Video","6uw3r74x369w7x2"],
    [46,"Klaipėdos","Panevėžys","Video","d1j7r55xm5cp99b"],
    [47,"Vilniaus","Panevėžys","Video","7a3hcv0msk3v0ef"],
    [48,"Centras","Panevėžys","Video","853f8yr79vdag2p"],
    [49,"Maxima","Panevėžys","Video","u3zcf01iy9glj1l"],
    [50,"Mažeikiai","Regionai","Video","n7sr9hbbkr2uvao"],
    [51,"Alytus","Regionai","Video","u4ixti0cnz15zj7"],
    [52,"Marijampolė","Regionai","Video","x5uni2b7yhbuxkc"],
    [53,"Utena","Regionai","Video","05hvh041gjgipin"],
    [54,"Jonava","Regionai","Video","rh3w0wgpatjrqmt"],
    [55,"Tauragė","Regionai","Video","ckvy4m8zlne14vp"],
    [56,"Joniškis","Regionai","Video","5wlrmdzgey7vxoy"]
  ];
  var CITIES = ["Visi", "Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Regionai"];
  var DAYS = ["P", "A", "T", "K", "P", "Š", "S"];

  function readOrders() {
    try {
      var raw = JSON.parse(localStorage.getItem("pikselHubTestOrders") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      return [];
    }
  }

  function pathToken() {
    var params = new URLSearchParams(location.search);
    var fromQuery = params.get("campaign") || "";
    if (fromQuery) return fromQuery;
    var parts = location.pathname.split("/").filter(Boolean);
    var last = parts[parts.length - 1] || "";
    return /^[a-zA-Z0-9_-]{8,64}$/.test(last) && last !== "index.html" ? last : "";
  }

  function findOrder() {
    var params = new URLSearchParams(location.search);
    var id = params.get("testOrderId") || "";
    var token = pathToken();
    var orders = readOrders();
    var withTest = id.indexOf("test-") === 0 ? id : id ? "test-" + id : "";
    var bare = id.replace(/^test-/, "");
    return (
      orders.find(function (item) {
        if (id && (item.id === id || item.id === withTest || String(item.invoice_id || "") === bare)) {
          return true;
        }
        if (!token) return false;
        return item.publicToken === token || (item.details && item.details.publicToken === token);
      }) || null
    );
  }

  function isViaduct(order) {
    if (!order) return false;
    var plan = (order.details && order.details.plan) || {};
    if (order.viaduct === true || plan.viaduct === true || plan.mode === "viaducts") return true;
    var rows = Array.isArray(plan.screenRows) ? plan.screenRows : [];
    return rows.length > 0 && rows.every(function (row) {
      return /viaduk/i.test(String((row && row.type) || ""));
    });
  }

  function mintToken() {
    var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    var bytes = new Uint8Array(15);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, function (b) { return alphabet[b % alphabet.length]; }).join("");
  }

  function persistToken(order, token) {
    if (!order || !token || String(order.id || "").indexOf("test-") !== 0) return;
    var orders = readOrders();
    var index = orders.findIndex(function (item) { return item.id === order.id; });
    if (index < 0) return;
    var previous = orders[index];
    if (previous.publicToken === token && previous.details && previous.details.publicToken === token) return;
    orders[index] = Object.assign({}, previous, {
      publicToken: token,
      details: Object.assign({}, previous.details || {}, { publicToken: token }),
    });
    try {
      localStorage.setItem("pikselHubTestOrders", JSON.stringify(orders));
    } catch (error) {}
  }

  function selectedKeys(order) {
    var ids = {};
    var names = {};
    if (!order) return { ids: ids, names: names };
    var plan = (order.details && order.details.plan) || {};
    (Array.isArray(order.screens) ? order.screens : []).forEach(function (value) {
      ids[String(value)] = true;
      names[String(value).trim()] = true;
    });
    (Array.isArray(plan.screenNames) ? plan.screenNames : []).forEach(function (name) {
      if (name) names[String(name).trim()] = true;
    });
    (Array.isArray(plan.screenRows) ? plan.screenRows : []).forEach(function (row) {
      if (row && row.catalogId) ids[String(row.catalogId)] = true;
      if (row && row.name) names[String(row.name).trim()] = true;
    });
    return { ids: ids, names: names };
  }

  function pillClass(type) {
    if (type === "Video") return "video";
    if (type === "Statinis") return "static";
    return "viaduct";
  }

  function typeIcon(type) {
    if (type === "Video") {
      return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.25 3.5 12 8l-6.75 4.5z" /></svg>';
    }
    if (type === "Statinis") {
      return '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><circle cx="5.5" cy="6" r="1" /><path d="m4 11 2.8-2.8 1.8 1.8 1.4-1.4 2 2" /></svg>';
    }
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="5" width="13" height="6" rx="1.5" /><path d="M4 5V3.5M12 5V3.5M5 11v1.5M11 11v1.5" /></svg>';
  }

  function formatCount(count) {
    var lastTwo = count % 100;
    var lastOne = count % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return count + " ekranų";
    if (lastOne === 1) return count + " ekranas";
    if (lastOne >= 2 && lastOne <= 9) return count + " ekranai";
    return count + " ekranų";
  }

  function paintMeta(order) {
    if (!order) return;
    var strongs = document.querySelectorAll(".topbar-meta strong");
    if (strongs[0]) strongs[0].textContent = order.client || "X";
    if (strongs[1]) strongs[1].textContent = order.agency || "—";
    if (strongs[2]) {
      var no = String(order.invoice_id || order.id || "").replace(/^test-/, "").replace(/^U-/, "");
      strongs[2].textContent = no ? "U-" + no : "U-—";
    }
    var from = document.getElementById("dateFrom");
    var to = document.getElementById("dateTo");
    if (from && order.from) from.value = order.from;
    if (to && order.to) to.value = order.to;
    var token = (order.details && order.details.publicToken) || order.publicToken || "";
    if (!token && String(order.id || "").indexOf("test-") === 0) {
      token = mintToken();
      persistToken(order, token);
    }
    var input = document.getElementById("goShareLinkInput");
    if (input && token) input.value = location.origin + "/" + encodeURIComponent(token);
  }

  function paintScreens(order) {
    var body = document.getElementById("screensTableBody");
    if (!body || body.children.length) return;
    var viaduct = isViaduct(order);
    var keys = selectedKeys(order);
    var visible = SCREENS.filter(function (screen) {
      return viaduct ? screen[3] === "Viadukas" : screen[3] !== "Viadukas";
    });
    var selectedCount = 0;
    var html = visible.map(function (screen) {
      var selected =
        keys.ids[String(screen[0])] ||
        keys.ids[String(screen[4])] ||
        keys.ids[screen[1]] ||
        keys.names[screen[1]];
      if (selected) selectedCount += 1;
      var type = screen[3];
      return (
        '<tr class="' + (selected ? "selected" : "") + '">' +
          "<td><div class=\"screen-cell\">" +
            '<label class="switch"><input type="checkbox" data-screen-id="' + screen[0] + '"' +
              (selected ? " checked" : "") + " /><span></span></label>" +
            '<div class="screen-copy"><div class="screen-title-line">' +
              "<strong>" + screen[1] + "</strong>" +
              '<span class="format-pill ' + pillClass(type) + '">' + typeIcon(type) + type + "</span>" +
            "</div><span>" + screen[2] + "</span></div></div></td>" +
          '<td class="muted-value">—</td><td class="muted-value">—</td><td class="muted-value">—</td>' +
          '<td class="muted-value">—</td><td class="muted-value">—</td><td class="muted-value">—</td>' +
          '<td class="muted-value">—</td></tr>'
      );
    }).join("");
    body.innerHTML = html;
    var filters = document.getElementById("cityFilters");
    if (filters && !filters.children.length) {
      var cities = viaduct ? ["Visi", "Vilnius"] : CITIES;
      filters.innerHTML = cities.map(function (city) {
        var count = city === "Visi"
          ? visible.length
          : visible.filter(function (screen) { return screen[2] === city; }).length;
        return '<button class="' + (city === "Visi" ? "active" : "") + '" data-city="' + city + '">' +
          city + " · " + count + "</button>";
      }).join("");
    }
    var footer = document.getElementById("footerScreens");
    if (footer) footer.textContent = formatCount(selectedCount);
  }

  function paintGrid(order) {
    var table = document.getElementById("scheduleGrid");
    if (!table || table.children.length) return;
    var plan = (order && order.details && order.details.plan) || {};
    var grid = Array.isArray(plan.grid) && plan.grid.length === 7 ? plan.grid : null;
    var rows = "";
    for (var hour = 6; hour <= 22; hour += 1) {
      var hourIndex = hour - 6;
      var cells = "";
      for (var day = 0; day < 7; day += 1) {
        var active = grid
          ? Boolean(grid[day] && grid[day][hourIndex])
          : (day + hourIndex) % 2 === 0;
        cells +=
          '<td><button type="button" class="' + (active ? "active" : "") +
          '" data-day="' + day + '" data-hour="' + hourIndex + '"></button></td>';
      }
      rows +=
        "<tr><td><button type=\"button\" class=\"axis-btn\" data-toggle-hour=\"" +
        hourIndex + "\">" + hour + "–" + (hour + 1) + "</button></td>" + cells + "</tr>";
    }
    table.innerHTML =
      "<thead><tr><th>Val.</th>" +
      DAYS.map(function (day, dayIndex) {
        return '<th><button type="button" class="axis-btn" data-toggle-day="' + dayIndex + '">' + day + "</button></th>";
      }).join("") +
      "</tr></thead><tbody>" + rows + "</tbody>";
  }

  try {
    var order = findOrder();
    paintMeta(order);
    paintScreens(order);
    paintGrid(order);
  } catch (error) {}
})();
