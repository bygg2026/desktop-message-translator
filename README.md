<!-- Copyright 2014 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# 🌐 Desktop Message Translator V2

**让跨语言聊天更顺畅：基于 Signal Desktop 的非官方桌面翻译客户端。**

支持 Google 翻译与自定义 OpenAI-compatible API，提供接收消息译文和发送前预览。项目与 Signal 官方独立维护。

## ✨ 功能亮点

- 🌍 **双翻译引擎**：Google Translate，或你自己的兼容 API。
- 💬 **双向阅读译文**：聊天时间线左右两侧均保留原文，并按接收语言显示译文。
- ✍️ **发送前确认**：首次提交生成译文，再次提交确认发送。
- 🎛️ **灵活配置**：收发语言分别设置，自定义模型与发送语气。
- 🔐 **密钥保护**：使用系统加密存储，设置页仅显示是否已保存。
- ⏱️ **失败可重试**：请求超时、有限缓存、输入变化检查和可见错误提示。
- 👥 **多账号多开**：菜单“账号 → 管理账号”新增独立账号、同时打开窗口、重命名、移出列表与恢复；现有登录保留为默认账号。
- 🧩 **独立安装**：独立应用标识及数据目录，保留原有 Signal 数据。

## 🚧 当前版本状态

**V2** 是本项目发布名称，内部沿用 Signal Desktop **8.36.0-alpha.1** 版本基线。全项目类型检查、生产资源构建、九项回归及集成测试及 Google 固定文本实网测试通过。用户已确认右侧消息中文译文显示正常；多账号独立目录与同账号单实例锁已通过双窗口诊断测试。完整验证范围和已知限制以 Release 说明为准。

## 🚀 使用方式

1. 在本仓库 [Releases](https://github.com/bygg2026/desktop-message-translator/releases) 查看已发布版本及验证说明。
2. 安装后通过手机 Signal 关联桌面设备；新版本使用独立配置目录。
3. 打开设置中的 **消息翻译 / Message translation**，选择 Google 或自定义 API。
4. 验证配置并保存。发送文字时，先预览译文，再确认发送。

翻译开启后，待译消息明文会发送到所选服务商。自定义 API 的地址、模型和可选密钥由你配置；空白密钥保留已存密钥，清除按钮明确删除密钥。

## 🛠️ 构建与反馈

构建步骤、数据目录及验证记录见 [构建说明](BUILD-TRANSLATOR.md)。问题请提交到 [本项目 Issues](https://github.com/bygg2026/desktop-message-translator/issues)，附系统版本、应用版本与复现步骤，并移除日志中的个人内容和密钥。

本分支关闭 Signal 官方自动更新，后续更新由本项目发布。保留上游版本过期检查，需要持续跟进上游版本；本次升级不代表永久免维护。

## 🙏 上游致谢

以下保留 Signal Desktop 的原始项目说明及许可证信息。翻译功能问题请反馈到本仓库。

# Signal Desktop

Signal Desktop links with Signal on [Android](https://github.com/signalapp/Signal-Android) or [iOS](https://github.com/signalapp/Signal-iOS) and lets you message from your Windows, macOS, and Linux computers.

[Install the production version](https://signal.org/download/) or help us out by [installing the beta version](https://support.signal.org/hc/articles/360007318471-Signal-Beta).

## Got a question?

You can find answers to a number of frequently asked questions on our [support site](https://support.signal.org/).
The [community forum](https://community.signalusers.org/) is another good place for questions.

## Found a Bug?

Please search for any [existing issues](https://github.com/signalapp/Signal-Desktop/issues) that describe your bug in order to avoid duplicate submissions.

## Have a feature request, question, comment?

Please use our community forum: https://community.signalusers.org/

## Contributing to the project

Please see [CONTRIBUTING.md](https://github.com/signalapp/Signal-Desktop/blob/main/CONTRIBUTING.md). There are lots of ways to contribute - many that don't involve code!

## Donate to Signal

You can donate to Signal from inside Signal apps (Desktop, Android, or iOS), or via the web here: [Signal Technology Foundation](https://signal.org/donate). Signal is an independent 501c3 nonprofit.

## Cryptography Notice

This distribution includes cryptographic software. The country in which you currently reside may have restrictions on the import, possession, use, and/or re-export to another country, of encryption software.
BEFORE using any encryption software, please check your country's laws, regulations and policies concerning the import, possession, or use, and re-export of encryption software, to see if this is permitted.
See <http://www.wassenaar.org/> for more information.

The U.S. Government Department of Commerce, Bureau of Industry and Security (BIS), has classified this software as Export Commodity Control Number (ECCN) 5D002.C.1, which includes information security software using or performing cryptographic functions with asymmetric algorithms.
The form and manner of this distribution makes it eligible for export under the License Exception ENC Technology Software Unrestricted (TSU) exception (see the BIS Export Administration Regulations, Section 740.13) for both object code and source code.

## License

Copyright 2013-2024 Signal Messenger, LLC

Licensed under the GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html
