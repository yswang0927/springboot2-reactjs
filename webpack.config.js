// @@@@@
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');
const CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

//将相对路径解析为绝对路径，__dirname是nodejs的一个全局变量，它指向当前执行脚本所在的目录
function resolvePath(relatedPath) {
    return path.join(__dirname, relatedPath);
}

function buildTime() {
    var now = new Date();
    var m = now.getMonth() + 1, d = now.getDate();
    if (m < 10) {
        m = '0' + m;
    }
    if (d < 10) {
        d = '0' + d;
    }
    return [now.getFullYear(), m, d].join('');
}

const config = {
    // 打包模式:'production' or development'
    mode: process.env.NODE_ENV,
    target: ['web', 'es5'],
    devtool: process.env.NODE_ENV === 'development' ? 'eval-cheap-module-source-map' : 'hidden-nosources-source-map',
    // entry 为webpack解析的入口, 指示 webpack 应该使用哪个模块来作为构建其内部依赖图的开始
    // 多入口文件配置
    entry: {
        // 主应用入口
        app: resolvePath('./src/frontend/index.js')
    },
    // output为项目打包后的输出位置
    // 官网描述：告诉 webpack 在哪里输出它所创建的 bundles，以及如何命名这些文件
    output: {
        pathinfo: false,
        path: resolvePath('./src/main/resources/webapp/assets/app/'), //打包后的文件存放的路径
        filename: `[name].${buildTime()}.js`, //打包后的入口文件的文件名, 注意使用了变量
        chunkFilename: `chunks.[name].${buildTime()}.js` // 非入口文件的文件名
    },
    resolve: {
        // 使用 alias 把导入 react 的语句换成直接使用单独完整的 react.production.min.js 文件，减少耗时的递归解析操作
        /*alias: {
            'react': resolvePath('./node_modules/react/umd/react.production.min.js'),
            'react-dom': resolvePath('./node_modules/react-dom/umd/react-dom.production.min.js')
        },*/
        // 尽可能的减少后缀尝试的可能性
        extensions: ['.js', '.tsx', '.ts'],
        // 使用绝对路径指明第三方模块存放的位置，以减少搜索步骤
        modules: [resolvePath('node_modules')]
    },
    // 这里不能配置为默认true，否则maven构建将卡死
    watch: false,
    watchOptions: {
        // 监听到文件变化后等 1000 毫秒再去执行
        aggregateTimeout: 1000,
        // 每n秒检查一次变动
        poll: 1000,
        ignored: ['node_modules', 'src/main/**', 'src/test/**', 'target/**']
    },
    module: {
        rules: [
            {
                test: /\.jsx|js?$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        // 缓存转换出的结果
                        cacheDirectory: true,
                        // 只对src/frontend目录下的文件使用babel-loader处理，可以缩小命中范围
                        include: resolvePath('./src/frontend'),
                        presets: ["@babel/preset-env", "@babel/preset-react"]
                    }
                }]
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: 'ts-loader'
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, "css-loader"]
            },
            {
                test: /\.less$/,
                use: [MiniCssExtractPlugin.loader, "css-loader", "less-loader"]
            },
            {
                test: /\.(png|jpg|gif|svg)$/i,
                loader: 'url-loader',
                options: {
                    limit: 8196,
                    esModule: false
                },
                type: 'javascript/auto'
            }
        ]
        // 没有采用模块化，忽略递归解析处理
        /*noParse: [
            resolvePath('node_modules/react/umd/react.production.min.js'),
            resolvePath('node_modules/react-dom/umd/react-dom.production.min.js')
        ]*/
    },
    optimization: {
        // 内置的拆包API
        splitChunks: {
            chunks: 'all', // 共有三个值可选：initial(初始模块)、async(按需加载模块)和all(全部模块)
            minSize: 30000, // 模块超过30k自动被抽离成公共模块
            minChunks: 1, // 模块被引用>=1次，便分割
            name: false, // 默认由模块名+hash命名，名称相同时多个模块将合并为1个，可以设置为function
            automaticNameDelimiter: '-', // 命名分隔符
            cacheGroups: {
                // default会将自定义代码部分默认打成一个包，即src里的js代码
                default: {
                    minChunks: 10, // 模块被引用>=2次，拆分至vendors公共模块
                    priority: -20, // 优先级，优先级越高则越先拆包，即对于同一个依赖包，该依赖包会优先被打包进优先级高的包里
                    reuseExistingChunk: true // 默认使用已有的模块
                },
                // vendor将node_modules文件夹下的内容都统一打包到vendor中，因为一般第三方插件的内容不会轻易改变
                // 此处也是拆包的重点区域，因为node_modules里的内容太多，打出来的包会很大，在首页一次加载会影响加载速度，
                // 所以会将一些不常用且非必须的包拆出来，如echarts等，后面通过动态加载的方式引进来
                defaultVendors: {
                    test: /[\\/]node_modules[\\/]/, // 匹配的规则，可以为文件夹，也可以为具体的文件，如 指定文件夹/[\\/]node_modules[\\/]/,待指定后缀文件 /\.(css|less)$/,具体文件/base.less|index.less/
                    name: 'vendor', // 此处的name,即为打包后包的name
                    filename: `[name].bundle.${buildTime()}.js`,
                    priority: -10, // 确定模块打入的优先级
                    reuseExistingChunk: true, // 使用复用已经存在的模块
                    enforce: true
                }
                /*,
                styles: {
                name: 'styles',
                test: /\.(css|less)$/,
                priority: 10, //确定模块打入的优先级
                chunks: 'all',
                enforce: true
                }*/
            }
        },
        //压缩js,css
        minimize: true,
        minimizer: [
            new TerserWebpackPlugin(),
            new CssMinimizerWebpackPlugin()
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            // 从全局提供React变量，业务组件不必显式 import React from 'react'
            React: 'react'
        }),
        // 清理之前打包的资源文件
        new CleanWebpackPlugin(),
        // 拷贝模板文件
        /*new CopyWebpackPlugin({
            patterns: [
                { from: resolvePath('./src/frontend/aev/templates'), to: resolvePath('./src/main/resources/webapp/views/apps/aev/') }
            ]
        }),*/
        /*
        // 示例1：多入口文件打包，每个入口文件对应一个 new HtmlWebpackPlugin() 配置
        new HtmlWebpackPlugin({
            template: resolvePath('./src/main/frontend/app.html'),
            filename: 'app.html',
            inject: 'body',
            // 输出的html文件引入的入口chunk
            // 注意：如果没有配置，那么生成的HTML会引入所有入口 JS 文件，即上面entry中配置的所有入口文件，
            // 所以要使用 chunks 配置来指定生成的 HTML 文件应该引入哪个 JS 文件。
            chunks: ['vendor', 'app']
        }),
        // 示例2
        new HtmlWebpackPlugin({
            template: resolvePath('./src/main/frontend/admin.html'),
            filename: 'admin.html',
            inject: 'body',
            chunks: ['vendor', 'admin']
        }),
        */
        // 提取css到单独的文件中，为每个包含 CSS 的 JS 文件创建一个 CSS 文件
        new MiniCssExtractPlugin({
            // 此选项决定了输出的每个 CSS 文件的名称，默认 [name].css
            filename: `[name].${buildTime()}.css`
            // 此选项决定了非入口的 chunk 文件名称
            //chunkFilename: ""
        })
    ]
};

module.exports = config;
