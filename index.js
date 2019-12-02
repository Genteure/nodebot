const { CQWebSocket } = require('cq-websocket');
const fs = require('fs');
const noderegex = /^\+node(?:\n|\r)*(.+)$/s;
const ws = new CQWebSocket({
    accessToken: 0,
    host: 0,
    port: 0,
    qq: 0
});

var handler = {};
var state = {};
class Bot {
    send_count = 5;
    user_id;
    group_id;
    state = state;
    raw_bot_connection = ws;
    constructor(user_id, group_id) {
        this.user_id = user_id;
        this.group_id = group_id;
    }
    log = (...msg) => {
        console.log(msg.join(''))
        if (this.send_count-- > 0)
            ws('send_msg', { user_id: this.user_id, group_id: this.group_id, message: msg.join('') })
        if (this.send_count == 0)
            ws('send_msg', { user_id: this.user_id, group_id: this.group_id, message: "你话太多啦！" })
        if (this.send_count < -20) {
            ws('send_msg', { user_id: this.user_id, group_id: this.group_id, message: "嗯。。？告辞" })
            require('process').exit(1)
        }
    }
    screenshot(url, wait, callback) {
        if (typeof (wait) === 'function')
            callback = wait;
        if (typeof (wait) !== 'number')
            wait = 0

        require('puppeteer').launch({
            defaultViewport: {
                width: 1852,
                height: 976
            }
        }).then(async b => {
            try {
                const page = await b.newPage();
                await page.goto(url, { waitUntil: 'networkidle0' })
                await page.waitFor(wait);
                const image = await page.screenshot({ fullPage: true, encoding: 'base64' })
                if (callback)
                    callback(image)
                else
                    this.log(`[CQ:image,file=base64://${image}]`)
            } catch (e) {
                this.log('截图时发生错误\n' + e)
            }
            await b.close()
        })
    }
    set(id, regex, code, flag = '') {
        if (typeof (code) === "function")
            code = code.toString().match(/^\(.*?\) *=> *{?(.*?)}? *$/s)[1];
        handler[id] = { regex, flag, code };
        this.save()
    }
    unset(id) {
        delete handler[id]
        this.save()
    }
    load() {
        handler = JSON.parse(fs.readFileSync('handler.json'))
    }
    save() {
        fs.writeFileSync('handler.json', JSON.stringify(handler))
    }
    list() {
        let r = 'handler 列表：\n功能ID  匹配表达式\n';
        for (const id of Object.keys(handler)) {
            r += `${id}  /${handler[id].regex}/${handler[id].flag}\n`
        }
        this.log(r)
    }
    showcode(id) {
        let data = handler[id] || null
        if (data != null) {
            this.log(`${id}  /${data.regex}/${data.flag}\n` + data.code)
        } else {
            this.log("id 不存在")
        }
    }
    encode(str) {
        return str.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/&/g, '&amp;')
    }
}

try {
    (new Bot()).load()
} catch (error) { }

ws.on('message', (event, context) => {
    const message = context.message.replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&amp;/g, '&');
    console.log(JSON.stringify(context))
    console.log(message)
    const nodematch = message.match(noderegex);
    const bot = new Bot(context.sender.user_id, context.group_id)
    if (nodematch) {
        let codestr = nodematch[1];
        try {
            new Function('bot', 'context', 'require', 'process', codestr)(bot, context, require, require('process'));
        } catch (error) {
            bot.log('运行代码出现错误\n', error)
        }
    } else {
        for (const id of Object.keys(handler)) {
            // console.log(id)
            let match = message.match(new RegExp(handler[id].regex, handler[id].flag))
            if (match) {
                console.log("运行" + id);
                try {
                    if (
                        !(new Function('bot', 'context', 'require', 'process', 'match', handler[id].code)
                            (bot, context, require, require('process'), match))
                    )
                        break;
                } catch (error) {
                    bot.log('运行匹配出现错误\n', id, '\n', error)
                }
            } else {
                console.log("跳过" + id);
            }
        }
    }
})

ws.connect()
