const request = require('request');
const fs = require('fs');
const unzip = require('unzip2');
const sharp = require('sharp');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');

const emojis = [
  '😊',
  '🙂',
  '😋',
  '😺',
  '🐶',
  '🐱',
  '🐰',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐵',
  '🐧',
  '🐔',
  '🦋',
];

const langs = [
  'zh-Hant',
  'ja',
  'zh-Hans',
  'en',
  'ko'
];

let restarting = 0;

setInterval(() => {
  if (restarting === 0) {
    return;
  }
  if (restarting < Date.now()) {
    process.exit();
  }
  var sec = Math.floor((restarting - Date.now()) / 1000);
  if (sec % 5 === 0) {
    console.log('Restart in ' + Math.floor((restarting - Date.now()) / 1000) + ' seconds');
  }
}, 1000);

setInterval(() => {
  for (var lid in pendingSticker) {
    if (pendingSticker[lid].cd === undefined) {
      continue;
    }
    if (pendingSticker[lid].cd <= 0) {
      continue;
    }
    if (pendingSticker[lid].cd > Date.now()) {
      continue;
    }

    pendingSticker[lid].msg.timestamp = Date.now();   // reset error state
    pendingSticker[lid].cd = 0;
    uploadBody(pendingSticker[lid].msg, lid);
  }

  for (var lid in pendingSticker) {
    if (pendingSticker[lid].deleting === undefined) {
      continue;
    }

    bot2.getStickerSet('line' + lid + '_by_' + config.botName2)
    .then((set) => {
      console.log('deleting', lid, set.stickers.length);
      if (set.stickers.length === 0) {
        delete pendingSticker[lid].deleting;
        pendingSticker[lid].cd = 0;
        uploadBody(pendingSticker[lid].msg, lid);
        return;
      }

      for (var i=0; i<set.stickers.length; i++) {
        bot2.deleteStickerFromSet(set.stickers[i].file_id);
      }
    });
  }
}, 1000);

const bot1 = new TelegramBot(config.token1, {
  polling: true
});

const bot2 = new TelegramBot(config.token2);

const userCD = {};
const pendingSticker = {};

bot1.on('message', (msg) => {
  if (userCD[msg.from.id] !== undefined) {
    if (Date.now() - userCD[msg.from.id] <  2 * 1000)
      return;
  }
  userCD[msg.from.id] = Date.now();

  console.log(msg);

  if (msg.sticker !== undefined) {
    var text = '您的使用者編號: <code>' + msg.from.id + '</code>\n';
    if (msg.sticker.set_name !== undefined) {
      text += '貼圖包編號: <code>' + msg.sticker.set_name + '</code>\n';
      text += '貼圖表符: ' + msg.sticker.emoji + ' (<a href="http://telegra.ph/Sticker-emoji-06-03">編輯</a>)\n';
    }
    text += '貼圖大小: <b>' + msg.sticker.width + '</b>x<b>' + msg.sticker.height + '</b>\n';
    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML'
    })
    .then((result) => {
      msg.msgId = result.message_id
      if (msg.sticker.set_name !== undefined) {
        var found = msg.sticker.set_name.match(/^line(\d+)_by_Sean_Bot$/);
        if (found) {
          const lid = found[1];
          checkPack(msg, lid)
          .catch((text) => {
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🔔 好了通知我一聲',
                      callback_data: 'notify_' + lid
                    }
                  ]
                ]
              }
            });
          });
        }
      }
    });
    return;
  }

  if (msg.text === undefined)
    return;

  if (msg.text.startsWith('/restart')) {
    if (config.admins.indexOf(msg.from.id) < 0)
      return;

    var text = '指令生效\n';
    if (restarting === 0) {
      var sec = 60;
      if (msg.text.length > 9) {
        sec = msg.text.substr(9);
      }
      restarting = Date.now() + sec * 1000;
      text += '已開啟停機模式';
    } else {
      restarting = 0;
      text += '已恢復正常模式';
    }
    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  if (msg.text == '/start SECRET') {
    var text = '歡迎使用 LINE 貼圖轉換器\n';
    text += '您已啟動完成，直接分享貼圖連結過來，就會自動下載囉~\n\n';
    text += '如有任何疑慮，歡迎至<a href="https://t.me/StickerGroup">貼圖群</a>詢問';

    bot1.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '探索更多貼圖',
              url: 'https://t.me/StickerGroup'
            }
          ]
        ]
      }
    });
    return;
  }

  if (msg.text == '/start edit_emoji') {
    var text = '這邊有教學喔 :D\n';
    text += 'http://telegra.ph/Sticker-emoji-06-03';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  if (msg.text == '/start about') {
    var text = '原始碼: <a href="https://git.io/line">GitHub</a>\n\n';
    text += '別忘了參考我的另一個專案 <a href="https://t.me/Telegreat">Telegreat Desktop</a>\n';
    text += '支援<a href="https://t.me/TelegreatFAQ/8">匯出貼圖連結</a>，效果參見<a href="https://t.me/StickerGroup/67327">這裡</a>\n\n';
    text += '假如您的 LINE 貼圖不希望被轉換，請向<a href="https://t.me/SeanChannel">開發者</a>反應，將會協助加入黑名單\n';
    text += '有任何建議，歡迎至<a href="https://t.me/StickerGroup">貼圖群</a>或是 <a href="https://t.me/AntiLINE">Anti-LINE 群</a>提出';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '更多小玩意',
              url: 'https://t.me/SeanChannel'
            },
            {
              text: '貼圖匯出工具',
              url: 'https://t.me/Telegreat'
            }
          ]
        ]
      }
    });
    return;
  }

  var found = msg.text.match(/(?:line.me\/(?:S\/sticker|stickershop\/product)\/|line:.+?|Number=|\/(?:line|start)[_ ]*)(\d{3,})/);

  if (!found) {
    if (msg.chat.id < 0)
      return;
    var text = '歡迎使用 LINE 貼圖轉換器\n';
    text += '使用前，請先確定已啟動完成\n';
    text += '更多訊息請點<a href="https://t.me/Sean_LINE_bot?start=about">這裡</a>\n\n';
    text += '\nℹ️ 本機器人由 <a href="https://t.me/SeanChannel">Sean</a> 提供';

    bot1.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '點我啟動',
              url: 'https://t.me/' + config.botName2 + '?start=sticker_dl_start_' + msg.from.id
            }
          ]
        ]
      }
    });
    return;
  }

  if (msg.from.username === undefined) {
    var text = '請先設定 username 喔 😃';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '點我看教學',
              url: 'https://t.me/UNameBot?start=Sean_LINE_bot'
            }
          ]
        ]
      }
    });
    return;
  }

  const lid = found[1];

  if (!fs.existsSync('files/' + lid)) {
    fs.mkdirSync('files/' + lid);
  }
  if (fs.existsSync('files/' + lid + '/metadata')) {
    const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));
    meta.error = [];

    if (meta.done !== undefined) {
      if (meta.done.length == meta.stickers.length) {
        text = '<a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a> 已存在';
        bot1.sendMessage(msg.chat.id, text, {
          message_id: msg.msgId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '點我安裝',
                  url: 'https://t.me/addstickers/' + meta.name
                }
              ],
              [
                {
                  text: '分享給朋友',
                  url: 'https://t.me/share/url'
                  + '?url=' + encodeURIComponent('https://t.me/addstickers/' + meta.name)
                  + '&text=' + encodeURIComponent(meta.title + '\n\n一起用 @' + config.botName1 + ' 把貼圖搬運來吧~')
                }
              ]
            ]
          }
        })
        .then((result) => {
          msg.msgId = result.message_id;
          checkPack(msg, lid)
          .catch((text) => {
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🔔 好了通知我一聲',
                      callback_data: 'notify_' + lid
                    }
                  ]
                ]
              }
            });
          });
        });
        return;
      }

      if (pendingSticker[lid] !== undefined) {
        var text = '已中斷下載\n'
        text += '原因: 他人正在下載同款貼圖包\n';
        if (meta.done != undefined) {
          text += prog(meta.done.length, meta.stickers.length);
        }
        bot1.sendMessage(msg.chat.id, text, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔔 好了通知我一聲',
                  callback_data: 'notify_' + lid
                }
              ]
            ]
          }
        });
        return;
      }

      var text = '路邊撿到半包貼圖，接續上傳 💪\n';
      if (meta.done.length > 0) {
        text += prog(meta.done.length, meta.stickers.length);
        if (meta.done.length / meta.stickers.length >= 0.7) {
          text += '預覽連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
        }
      }
      bot1.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
      })
      .then((result) => {
        msg.msgId = result.message_id;
        uploadBody(msg, lid);
      });
      return;
    }
  }

  if (restarting > 0) {
    var text = '⚠️ 機器人要下班了\n\n';
    text += '機器人已排程重啟，為了維護貼圖包品質，將拒收新貼圖\n';
    text += '請過 <b>' + Math.floor((restarting - Date.now()) / 1000 + 5) + '</b> 秒後再點 /line_' + lid + ' 開始下載\n\n';
    text += '如有造成不便，我也不能怎樣 ¯\\_(ツ)_/¯';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_messsage_id: msg.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '先來去逛街',
              url: 'https://t.me/StickerGroup'
            }
          ]
        ]
      }
    });
    if (config.admins.indexOf(msg.from.id) < 0) {
      return;
    }
  }

  var text = '準備下載 <a href="https://store.line.me/stickershop/product/' + lid + '/zh-Hant">此貼圖</a>...';
  bot1.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_to_message_id: msg.message_id,
    disable_web_page_preview: true
  })
  .then((result) => {
    msg.msgId = result.message_id;

    downloadZip(lid)
    .catch((error) => {
      msg.timestamp = Date.now() + 9487 * 1000;
      bot1.editMessageText(error, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML'
      });
    })
    .then((dir) => {
      if (msg.timestamp > Date.now())
        return;

      const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));

      var text = '已取得 <a href="https://store.line.me/stickershop/product/' + lid + '/' + meta['lang'] + '">' + enHTML(meta.title) + '</a> 資訊...\n';
      bot1.editMessageText(text, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML'
      });

      const sid = meta.stickers[0].id;
      resizePng(dir, sid)
      .catch((error) => {
        msg.timestamp = Date.now() + 9487 * 1000;
        bot1.editMessageText(error, {
          chat_id: msg.chat.id,
          message_id: msg.msgId,
          parse_mode: 'HTML'
        });
      })
      .then((sticker) => {
        if (msg.timestamp > Date.now())
          return;

        const stat = fs.statSync(sticker);
        if (stat.size > 512 * 1000) {
        }

        bot2.createNewStickerSet(msg.from.id, meta.name, meta.title + "  @SeanChannel", sticker, meta.emoji)
        .catch((error) => {
          msg.timestamp = Date.now() + 9487 * 1000;
          meta.error.push(sid);

          var text = '發生錯誤，已中斷下載\n';
          if (error.message.includes('user not found')) {
            text += '請確定 <a href="https://t.me/' + config.botName2 + '">已於此啟動過機器人</a>\n';
          } else {
            text += '編號: <code>' + lid + '</code> \n';
            checkPack(msg, lid)
            .catch((text) => {
              bot1.editMessageText(text, {
                chat_id: msg.chat.id,
                message_id: msg.msgId,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '🔔 好了通知我一聲',
                        callback_data: 'notify_' + lid
                      }
                    ]
                  ]
                }
              });
            });
          }
          text += '詳細報告: createNewStickerSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
          });
        })
        .then((result) => {
          if (msg.timestamp > Date.now())
            return;
          if (meta.error.indexOf(sid) < 0) {
            meta.done = [ sid ];
            fs.writeFileSync(dir + '/metadata', JSON.stringify(meta));
            var text = '建立 <a href="https://store.line.me/stickershop/product/' + lid + '/' + meta['lang'] + '">' + enHTML(meta.title) + '</a> 中...\n';
            text += prog(meta.done.length, meta.stickers.length);
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              parse_mode: 'HTML'
            });
            uploadBody(msg, lid);
          }
          fs.appendFile(dir + '/request', JSON.stringify(msg), (error) => { console.error(error) });
        });
      });
    });
  });
});

function uploadBody(msg, lid) {
  if (restarting > 0 && config.admins.indexOf(msg.from.id) < 0 && config.admins.indexOf(msg.chat.id) < 0) {
    var text = '⚠️ 機器人要下班了\n\n';
    text += '機器人已排程重啟，為了維護貼圖包品質，將不再新增貼圖\n';
    text += '請過 <b>' + Math.floor((restarting - Date.now()) / 1000 + 5) + '</b> 秒後再點 /line_' + lid + ' 開始下載\n\n';
    text += '如有造成不便，我也不能怎樣 ¯\\_(ツ)_/¯';

    bot1.editMessageText(text, {
      chat_id: msg.chat.id,
      message_id: msg.msgId,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '先來去逛街',
              url: 'https://t.me/StickerGroup'
            }
          ]
        ]
      }
    });
    return;
  }

  const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));
  if (meta.emoji === undefined) {
    meta.emoji = emojis[0];
  }
  meta.error = [];

  if (pendingSticker[lid] === undefined) {
    pendingSticker[lid] = {
      cd: 0,
      msg: msg
    };
  }

  if (msg.timestamp === undefined) {
    msg.timestamp = Date.now();
  }

  if (meta.done === undefined) {
    checkPack(msg, lid)
    .catch((err) => {
      bot1.editMessageText(err, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML',
      });
    });
    return;
  }

  for (let i = 0; i < meta.stickers.length; i++) {
    const sid = meta.stickers[i].id;
    if (meta.done.indexOf(sid) > -1)
      continue;

    const dir = 'files/' + lid;

    resizePng(dir, sid)
    .catch((error) => {
      msg.timestamp = Date.now() + 9487 * 1000;
      bot1.editMessageText(error, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML'
      });
    })
    .then((sticker) => {
      bot2.addStickerToSet(msg.from.id, meta.name, sticker, meta.emoji)
      .catch((error) => {
        meta.error.push(sid);
        if (Date.now() < msg.timestamp)
          return;
        msg.timestamp = Date.now() + 9487 * 1000;

        var text;
        var opt = {
          chat_id: msg.chat.id,
          message_id: msg.msgId,
          parse_mode: 'HTML'
        };

        if (error.message.includes('user not found')) {
          text = '請確定 <a href="https://t.me/' + config.botName2 + '">已於此啟動過機器人</a>\n';
          text += '點擊 /line_' + lid + ' 重試\n';
        } else if (error.message.includes('retry after')) {
          text = '上傳速度太快啦，TG 伺服器要冷卻一下\n';
          text += '將會自動重試\n';
          text += prog(meta.done.length, meta.stickers.length);
          text += '貼圖包連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          sec = error.message.substr(46) + 3;
          pendingSticker[lid].cd = Date.now() + sec * 1000;
          opt['reply_markup'] = {
            inline_keyboard: [
              [
                {
                  text: '🔔 好了通知我一聲',
                  callback_data: 'notify_' + lid
                }
              ]
            ]
          };
        } else if (error.message.includes('STICKERS_TOO_MUCH')) {
          text = '貼圖數量衝破天際啦~\n';
          text += '貼圖包連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
        } else {
          text = '發生錯誤，已中斷下載\n';
          text += '編號: <code>' + lid + '</code> \n';

          checkPack(msg, lid)
          .catch((err) => {
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              parse_mode: 'HTML'
            });
          });
        }

        text += '\n詳細報告: addStickerToSet\n';
        text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';

        bot1.editMessageText(text, opt);
      })
      .then((result) => {
        if (meta.error.indexOf(sid) > -1)
          return;

        meta.done.push(sid);

        if (Date.now() < msg.timestamp)
          return;

        if (meta.done.length == meta.stickers.length) {
          var text = '上傳完成!\n';
          text += '共 <b>' + meta.stickers.length + '</b> 張貼圖\n';
          text += '安裝連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          if (meta.stickerResourceType !== undefined && meta.stickerResourceType !== 'STATIC') {
            text += 'PS. 移植後，動態/有聲貼圖將僅保留圖片';
          }
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '點我安裝',
                    url: 'https://t.me/addstickers/' + meta.name
                  },
                  {
                    text: '編輯表符',
                    callback_data: 'edit_emoji_' + meta.name
                  }
                ],
                [
                  {
                    text: '分享給朋友',
                    url: 'https://t.me/share/url'
                    + '?url=' + encodeURIComponent('https://t.me/addstickers/' + meta.name)
                    + '&text=' + encodeURIComponent(meta.title + '\n剛出爐的呦~')
                  }
                ]
              ]
            }
          });

          if (Array.isArray(pendingSticker[lid].users)) {
            for (var i=0; i<pendingSticker[lid].users.length; i++) {
              var text = '您訂閱的 <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a> 上傳完成囉 😃\n';
              text += '共 <b>' + meta.stickers.length + '</b> 張貼圖，快來試用看看吧！\n';
              bot1.sendMessage(pendingSticker[lid].users[i], text, {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '點我安裝',
                        url: 'https://t.me/addstickers/' + meta.name
                      }
                    ],
                    [
                      {
                        text: '分享給朋友',
                        url: 'https://t.me/share/url'
                        + '?url=' + encodeURIComponent('https://t.me/addstickers/' + meta.name)
                        + '&text=' + encodeURIComponent(meta.title + '\n新出爐的呦~')
                      }
                    ]
                  ]
                }
              });
            }
          }

          delete pendingSticker[lid];
        } else if (Date.now() - msg.timestamp > 300) {
          msg.timestamp = Date.now();
          var text = '上傳 <a href="https://store.line.me/stickershop/product/' + lid + '/' + meta['lang'] + '">' + enHTML(meta.title) + '</a> 中...\n';
          text += prog(meta.done.length, meta.stickers.length);
          if (meta.done.length / meta.stickers.length >= 0.7) {
            text += '預覽連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          }
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🔔 好了通知我一聲',
                    callback_data: 'notify_' + lid
                  }
                ]
              ]
            }
          });
        }
      })
      .finally(() => {
        fs.writeFileSync('files/' + lid + '/metadata', JSON.stringify(meta), (error) => { if (error) console.error(error) });

        if (meta.done.length == meta.stickers.length) {
          checkPack(msg, lid)
          .catch((text) => {
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🔔 好了通知我一聲',
                      callback_data: 'notify_' + lid
                    }
                  ]
                ]
              }
            });
          });
        }
      });
    });
  }
}


bot1.on('callback_query', (query) => {
  if (userCD[query.from.id] !== undefined) {
    if (Date.now() - userCD[query.from.id] <  2 * 1000)
      return;
  }
  userCD[query.from.id] = Date.now();

  if (query.data.startsWith('remove_')) {
    lid = query.data.substr(7);

    downloadZip(lid)
    .catch((error) => {
      query.timestamp = Date.now() + 9487 * 1000;
      bot1.editMessageText(error, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      });
    })
    .then((dir) => {
      if (query.timestamp > Date.now())
        return;

      query.message.msgId = query.message.message_id;
      checkPack(msg, lid)
      .catch((text) => {
        bot1.answerCallbackQuery(query.id, {
          text: '已排入處理佇列'
        });

        bot1.editMessageText(text, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔔 好了通知我一聲',
                  callback_data: 'notify_' + lid
                }
              ]
            ]
          }
        });
      })
      .then((text) => {
        bot1.answerCallbackQuery(query.id, {
          text: '看起來沒問題呀\n如真的怪怪的，請至群組提出',
          show_alert: 'true'
        });
      });
    });
  }

  if (query.data.startsWith('edit_emoji_')) {
    var text = '點這邊看<a href="http://telegra.ph/Sticker-emoji-06-03">表符修改教學</a>\n\n';
    text += '您的貼圖編號: <code>' + query.data.substr(11) + '</code>\n\n';
    text += '左轉找 @Stickers 機器人';

    bot1.sendMessage(query.message.chat.id, text, {
      reply_to_message_id: query.message.message_id,
      parse_mode: 'HTML'
    });

    bot1.answerCallbackQuery(query.id, {
      text: '您的貼圖編號: ' + query.data.substr(11)
    });
  }

  if (query.data.startsWith('notify_')) {
    const lid = query.data.substr(7);
    const uid = query.from.id;
    var text;
    if (pendingSticker[lid] === undefined) {
      text = '這款貼圖不在佇列中欸';
    } else {
      if (pendingSticker[lid].users === undefined) {
        pendingSticker[lid].users = [];
      }
      if (pendingSticker[lid].users.indexOf(uid) < 0) {
        pendingSticker[lid].users.push(uid);
        text = '訂閱完成！\n';
      } else {
        text = '您已經訂閱過了喔！\n';
      }
      text += '將會在完成時通知您 😊';
    }
    bot1.answerCallbackQuery(query.id, {
      text: text
    }).catch((error)=>{console.error("XXXXX", error.code, error.response.body);});;
  }
});

async function downloadZip(lid) {
  return new Promise(function(resolve, reject) {
    const dir = 'files/' + lid;
    const zipname = dir + '/file.zip';

    request('http://dl.stickershop.line.naver.jp/products/0/0/1/' + lid + '/iphone/stickers@2x.zip')
    .on('error', function (err) {
      var text = '發生錯誤，已中斷下載\n';
      text += '編號: <code>' + lid + '</code> \n';
      text += '詳細報告: NodeJS <b>request</b> onError\n';
      text += '<pre>' + enHTML(JSON.stringify(err)) + '</pre>';
      return reject(text);
    })
    .pipe(fs.createWriteStream(zipname))
    .on('finish', (result) => {
      const zipStat = fs.statSync(zipname);
      if (zipStat.size < 69) {
        const zipText = fs.readFileSync(zipname);
        var text = '發生錯誤，已中斷下載\n';
        text += '詳細報告: LINE 伺服器提供檔案不正常\n';
        text += '下載內容:\n'
        text += '<pre>' + enHTML(zipText) + '</pre>';
        return reject(text);
      }

      fs.createReadStream(zipname)
      .pipe(unzip.Parse())
      .on('entry', function (entry) {
        var fileName = entry.path;

        if (fileName == 'productInfo.meta') {
          entry.pipe(fs.createWriteStream(dir + '/metadata'));
          return;
        }

        if (/\d+@2x.png/.test(fileName)) {
          entry.pipe(fs.createWriteStream(dir + '/origin-' + fileName.replace('@2x', '')));
          return;
        }

        if (/(\d+_key|tab_(on|off))@2x.png/.test(fileName)) {
          entry.autodrain();
          return;
        }

        entry.pipe(fs.createWriteStream(dir + '/UNKNOWN-' + fileName));
      })
      .on('close', () => {
        // build metadata
        if (!fs.existsSync(dir + '/metadata')) {
          var text = '發生錯誤，已中斷下載\n';
          text += '問題來源: 找不到 <b>metadata</b> (中繼資料) 檔案\n';
          text += '編號: <code>' + lid + '</code> \n';
          return reject(text);
        }

        const meta = JSON.parse(fs.readFileSync(dir + '/metadata', 'utf8'));
        meta.error = [];
        meta.done = [];

        meta.name = 'line' + lid + '_by_' + config.botName2;
        meta.emoji = emojis[Math.floor(Math.random() * emojis.length)];

        langs.some(function (val) {
          if (meta['title'][val] !== undefined) {
            meta['lang'] = val;
            return true;
          }
        });

        meta.origin_title = meta.title;
        meta.title = meta['title'][meta.lang];

        fs.writeFileSync(dir + '/metadata', JSON.stringify(meta));

        return resolve(dir);
      })
      .on("error", (err) => {
        var text = '發生錯誤，已中斷下載\n';
        text += '編號: <code>' + lid + '</code> \n';
        text += '詳細報告: fs <b>createReadStream</b> onError\n';
        text += '<pre>' + enHTML(JSON.stringify(err)) + '</pre>';
        return reject(text);
      });
    });
  });
}

async function resizePng(dir, sid, q = 100) {
  return new Promise(function(resolve, reject) {
    if (q < 1) {
      var text = '發生錯誤，已中斷下載\n';
      text += '問題來源: resize webp\n';
      text += '編號: <code>' + sid + '</code> \n';
      text += '詳細報告: 檔案過大\n';
      return reject(text);
    }

    const origin = dir + '/origin-' + sid + '.png';
    const sticker = dir + '/sticker-' + sid + (q == 100 ? '' : '-' + q) + '.png';

    var format = 'webp';
    var tmpFile = dir + '/sticker-' + sid + '-' + q + '.webp';
    var size = 512;
    if (q < 64) {
      console.log(dir, sid, q);
      format = 'jpg';
      tmpFile = dir + '/sticker-' + sid + '-' + q + '.jpg';
      size = 8 * q;
    }

    sharp(origin)
    .toFormat(format, {
      quality: q
    })
    .resize(size, size)
    .max()
    .toFile(tmpFile)
    .catch((error) => {
      var text = '發生錯誤，已中斷下載\n';
      text += '問題來源: NodeJS <b>sharp</b> (圖片轉檔工具)\n';
      text += '編號: <code>' + sid + '</code> \n';
      text += '詳細報告: resize webp\n';
      text += '<pre>' + enHTML(error.message) + '</pre>';
      return reject(text);
    })
    .then((result) => {
      sharp(tmpFile)
      .resize(512, 512)
      .max()
      .png()
      .toFile(sticker)
      .catch((error) => {
        var text = '發生錯誤，已中斷下載\n';
        text += '問題來源: NodeJS <b>sharp</b> (圖片轉檔工具)\n';
        text += '編號: <code>' + sid + '</code> \n';
        text += '詳細報告: convert png\n';
        text += '<pre>' + enHTML(error.message) + '</pre>';
        return reject(text);
      })
      .then((result) => {
        var stat = fs.statSync(sticker);
        if (stat.size < 512 * 1000) {
          return resolve(sticker);
        }
        resizePng(dir, sid, Math.floor(q*0.8))
        .catch((err) => {
          return reject(err + '.');
        })
        .then((sticker) => {
          return resolve(sticker);
        });
      });
    })
  });
}

async function checkPack(msg, lid) {
  return new Promise(function(resolve, reject) {
    // resolve: Pack currect
    // reject:  Re-download
    if (!fs.existsSync('files/' + lid + '/metadata')) {
      return resolve('沒錯誤，但 metadata 消失了');
    }

    const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));

    bot2.getStickerSet('line' + lid + '_by_' + config.botName2)
    .catch((err) => {
      downloadZip(lid)
      .catch((err) => {
        return reject(err);
      })
      .then(() => {
        pendingSticker[lid] = {
          msg: msg,
          deleting: true
        };

        return reject('貼圖包已失效\n已排入佇列，將自動修復');
      });
    })
    .then((set) => {
      if (pendingSticker[lid] !== undefined) {
        return resolve('看起來有人正在下載呢');
      }

      if (meta.done !== undefined
        && (meta.stickers.length !== meta.done.length   // We didn't upload all stickers
        ||  meta.stickers.length === set.stickers.length)) {   // or Count is equal, we can't check content
        return resolve('看起來還沒下載完成\n如真的怪怪的，請至群組提出');
      }

      downloadZip(lid)
      .catch((err) => {
        return reject(err);
      })
      .then(() => {
        pendingSticker[lid] = {
          msg: msg,
          deleting: true
        };

        return reject('已排入處理佇列\n將會自動重新下載');
      });
    });
  });
}

function enHTML(str) {
  var s = str + '';
  return s.replace('&', '&amp;')
  .replace('"', '&quot;')
  .replace('<', '&lt;')
  .replace('>', '&gt;');
}

function prog(current, total) {
  if (current > total) {
    current = total;
  }
  const count = 20;
  var str = '進度: <b>' + current + '</b>/' + total + '  <code>[';
  str += '█'.repeat(Math.round(current * count / total))
  str += '-'.repeat(count - Math.round(current * count / total))
  str += ']</code>\n'
  return str;
}
