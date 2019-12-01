const { CQWebSocket } = require('cq-websocket');
const fs = require('fs');
const noderegex = /^\+node(?:\n|\r)*(.+)$/s;
const ws = new CQWebSocket({
    accessToken: ,
    host: ,
    port: ,
    qq: 
});

var handler = {};
class Bot {
    send_count = 5;
    user_id;
    group_id;
    constructor(user_id, group_id) {
        this.user_id = user_id;
        this.group_id = group_id;
    }
    log = (...msg) => {
        if (this.send_count-- > 0)
            ws('send_msg', { user_id: this.user_id, group_id: this.group_id, message: msg.join('') })
        if (this.send_count == 0)
            ws('send_msg', { user_id: this.user_id, group_id: this.group_id, message: "你话太多啦！" })
        if (this.send_count < -20) {
            ws('send_msg', { user_id: this.user_id, group_id: this.group_id, message: "嗯。。？告辞" })
            require('process').exit(1)
        }
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
}

(new Bot()).load()

ws.on('message', (event, context) => {
    const message = context.message.replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&amp;/g, '&');
    console.log(JSON.stringify(context))
    console.log(message)
    const nodematch = message.match(noderegex);
    const bot = new Bot(context.sender.user_id, context.group_id)
    if (nodematch) {
        let codestr = nodematch[1];
        try {
            new Function('bot', 'require', 'process', codestr)(bot, require, require('process'));
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
                    if (new Function('bot', 'require', 'process', 'match', handler[id].code)(bot, require, require('process'), match))
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
