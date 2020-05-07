var CHANNEL_ACCESS_TOKEN = "アクセストークン";
var dateExp = /(\d+)\/(\d+)\s(\d+):(\d+)/;

//doPost関数（Lineからメッセージを受け取る）
function doPost(e) {
    GetMessage(e);
}

//受け取ったメッセージの処理
function GetMessage(e) {
  var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
  if (typeof replyToken === 'undefined') {
    return;
  }
  var messageText = JSON.parse(e.postData.contents).events[0].message.text;
  var cache = CacheService.getScriptCache();
  var type = cache.get("type");

  if (type === null) {
    //予定の追加
    if (messageText === "予定の追加") {
      cache.put("type", 1);
    //開始日時の質問
      replyPlans(replyToken, "予定日をいずれかの形式で教えてください。", "12/1\n3:00", "4/1 13:00");
    //今日、７日間の予定の取得
    } else if (messageText.match("今日の予定")) {
      reply(replyToken, getEvents());
    }  else if (messageText.match("今週の予定")) {
      reply(replyToken, notifyWeekly());
    } else {
    //処理方法の返答
      replyPlans(replyToken, "「予定の追加」で予定追加します", "「今日の予定」で今日の予定をお知らせします。", "「今週の予定」で7日間の予定をお知らせします。");
    }
  } else {
    //キャンセル処理
    if (messageText === "キャンセル") {
      cache.remove("type");
      reply(replyToken, "予定追加のキャンセルをしました");
      return;
    } 

    switch(type) {
      case "1":
        // 開始日時の追加
        if ( messageText.match(dateExp)) {
          var [matched, start_month, start_day, start_Hour, start_Min] = messageText.match(dateExp);
          cache.put("type", 2);
          cache.put("start_month", start_month);
          cache.put("start_day", start_day);
          cache.put("start_hour", start_Hour);
          cache.put("start_min", start_Min);
          //終了日時の質問
          var year = new Date().getFullYear();
          //var year = 2020;
          var startDate = new Date(year, cache.get("start_month") - 1, cache.get("start_day"), cache.get("start_hour"), cache.get("start_min"));
          reply(replyToken,"開始日時は\n" + EventFormat(startDate) + "\nですね。\n\n次に予定の終了日時をお知らせください。");
          break;
        }else{
          reply(replyToken, "予定追加処理中です。\n「キャンセル」\nで追加作業をキャンセルします。");
          break;
        }
      case "2":
        // 終了日時の追加
        if ( messageText.match(dateExp)) {
          var [matched, end_month, end_day, end_Hour, end_Min] = messageText.match(dateExp);
          cache.put("type", 3);
          cache.put("end_month", end_month);
          cache.put("end_day", end_day);
          cache.put("end_hour", end_Hour);
          cache.put("end_min", end_Min);
          //予定名の質問
          var year = new Date().getFullYear();
          //var year = 2020;
          var endDate = new Date(year, cache.get("end_month") - 1, cache.get("end_day"), cache.get("end_hour"), cache.get("end_min"));
          reply(replyToken,"終了日時は\n" + EventFormat(endDate) + "\nですね。\n\n最後に予定名を教えてください。");
          break;
        }else{
          reply(replyToken, "予定追加処理中です。\n「キャンセル」\nで追加作業をキャンセルします。");
          break;
        }
      case "3":
        // 最終確認
        cache.put("type", 4);
        cache.put("title", messageText);
        var [title, startDate, endDate] = createData(cache);
        //予定追加の確認
        replyPlans(replyToken, "予定名：" + title, "開始日時：\n" + EventFormat(startDate)+ "\n終了日時：\n" + EventFormat(endDate), "予定を追加しますか？\n 「はい」か「いいえ」でお知らせください。");
        break;
      case "4":
        if (messageText === "はい") {
          cache.remove("type");
          var [title, startDate, endDate] = createData(cache);
          CalendarApp.getDefaultCalendar().createEvent(title, startDate, endDate);
          reply(replyToken, "Googleカレンダーに予定を追加しました");
        } else if (messageText === "いいえ") {
          cache.remove("type");
          reply(replyToken, "予定の追加をキャンセルしました。");
        } else{
          reply(replyToken, "「はい」か「いいで」でお答えください。");
          break;
        }
        break;
    }
  }
}

function createData(cache) {
  var year = new Date().getFullYear();
  //var year = 2020;
  var title = cache.get("title");
  var startDate = new Date(year, cache.get("start_month") - 1, cache.get("start_day"), cache.get("start_hour"), cache.get("start_min"));
  var endDate = new Date(year, cache.get("end_month") - 1, cache.get("end_day"), cache.get("end_hour"), cache.get("end_min"));
  return [title, startDate, endDate];
}

function EventFormat(Date) {
  var y = Date.getFullYear();
  var m = Date.getMonth() + 1;
  var d = Date.getDate();
  var w = Date.getDay();
  var H = Date.getHours();
  var M = Date.getMinutes();
  var weekname = ['日', '月', '火', '水', '木', '金', '土'];
  m = ('0' + m).slice(-2);
  d = ('0' + d).slice(-2);
  return y + '年' + m + '月' + d + '日 (' + weekname[w] + ')\n' + H + '時' + M + '分';
}

function replyPlans(replyToken, message, message2, message3) {
  var url = "https://api.line.me/v2/bot/message/reply";
  UrlFetchApp.fetch(url, {
    "headers": {
      "Content-Type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
    },
    "method": "post",
    "payload": JSON.stringify({
      "replyToken": replyToken,
      "messages": [{
        "type": "text",
        "text": message,
      },{
        "type": "text",
        "text": message2,
      },{
        "type": "text",
        "text": message3,
      }],
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({"content": "post ok"})).setMimeType(ContentService.MimeType.JSON);
}

function reply(replyToken, message) {
  var url = "https://api.line.me/v2/bot/message/reply";
  UrlFetchApp.fetch(url, {
    "headers": {
      "Content-Type": "application/json; charset=UTF-8",
      "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
    },
    "method": "post",
    "payload": JSON.stringify({
      "replyToken": replyToken,
      "messages": [{
        "type": "text",
        "text": message,
      }],
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({"content": "post ok"})).setMimeType(ContentService.MimeType.JSON);
}

//今日の予定
function getEvents() {
  var events = CalendarApp.getDefaultCalendar().getEventsForDay(new Date());
  var body = "今日の予定は";

  if (events.length === 0) {
    body += "ありません。";
    return body;
  }

  body += "\n";
  events.forEach(function(event) {
    var title = event.getTitle();
    var start = HmFormat(event.getStartTime());
    var end = HmFormat(event.getEndTime());
    body += "★" + title + ": " + start + " ~ " + end + "\n";
  });
  body += "です。";
  return body;
}

//７日間の予定
function notifyWeekly() {
  var  body = "7日間の予定は\n";
  var weekday = ["日", "月", "火", "水", "木", "金", "土"];
for ( var i = 0;  i < 7;  i++ ) {

  var dt = new Date();
  dt.setDate(dt.getDate()+i);
  var events = CalendarApp.getDefaultCalendar().getEventsForDay(dt);
  body += Utilities.formatDate(dt, "JST", '★ MM/dd(' + weekday[dt.getDay()] + ')') + "\n";
  if (events.length === 0) {
    body += "ありません。\n";
  }

  events.forEach(function(event) {
    var title = event.getTitle();
    var start = HmFormat(event.getStartTime());
    var end = HmFormat(event.getEndTime());
    body += title + ": " + start + " ~ " + end + "\n";
  });
}
  return body;
}

function HmFormat(date){
  return Utilities.formatDate(date, "JST", "HH:mm");
}
