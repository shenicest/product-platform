# 【PRD】产品展示平台

### TODO

- 项目阶段的命名：MVP阶段 & XX阶段？以及两个阶段的明确定义。本文档暂时用“成长阶段”作为临时表达
- founder提交作品的分类枚举
- 平台名称？本文档暂用“产品展示平台”代指。
- 其他需求点
  - 是否允许 Founder 在待审核状态下撤回审核并修改项目。
  - 一个项目是否允许多个 Founder 或协作者。
  - 是否允许用户在项目上线后自行修改前台展示信息。
    - 上线后修改需要重新审核？
- 一些文案与功能名称敲定
  - 例如“购买支持”、“Founder后台”等等
- 一期是否支持投票按钮？（和点赞的差异化之一：点赞可以取消，投票不能取消）
- 购买的交互（1.0先不做）
  - 有实体的，用户需要填写收货地址，founder自己发货吗？founder也需要看到收货地址来发货，founder
  - 没有实体的，用户支付之后怎么体验到服务？
- 内测申请的功能定义，是用户点击并留下联系方式就结束了吗？
- 项目展示排序规则

### 1.项目阶段与项目状态规则

<mention-doc token="V1sFwKaoIiKZQAkZGVdctENVnsg" type="wiki">产品展示平台功能模块</mention-doc>

### 2.功能模块目录

<lark-table rows="14" cols="4" header-row="true" column-widths="80,130,594,100">

  <lark-tr>
    <lark-td>
      章节
    </lark-td>
    <lark-td>
      功能
    </lark-td>
    <lark-td>
      目标
    </lark-td>
    <lark-td>
      优先级
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.1
    </lark-td>
    <lark-td>
      登录注册
    </lark-td>
    <lark-td>
      用户用手机号验证码登录。用户在投票、申请内测、提交评论前必须登录。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.6
    </lark-td>
    <lark-td>
      首页/项目列表
    </lark-td>
    <lark-td>
      展示平台内项目，支持按品类、阶段、活动筛选。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.3
    </lark-td>
    <lark-td>
      项目详情页
    </lark-td>
    <lark-td>
      展示项目介绍、Demo、Founder信息、项目阶段、成长数据和用户参与入口。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.2
    </lark-td>
    <lark-td>
      项目提交
    </lark-td>
    <lark-td>
      登录用户可以填写项目资料、上传Demo、选择项目阶段、保存草稿、提交审核。用户提交项目后，即成为该项目的 Founder。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.4
    </lark-td>
    <lark-td>
      用户互动
    </lark-td>
    <lark-td>
      用户可以点赞、关注、投人气票、分享项目。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.3
    </lark-td>
    <lark-td>
      内测申请
    </lark-td>
    <lark-td>
      用户可以对开放内测的项目申请内测，该项目 Founder 可以在后台查看申请。
    </lark-td>
    <lark-td>
      P1
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.4
    </lark-td>
    <lark-td>
      用户评论
    </lark-td>
    <lark-td>
      用户可以向项目提交评论。~~1.0评论不公开展示，只给Founder和运营查看。~~
    </lark-td>
    <lark-td>
      P1
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.6
    </lark-td>
    <lark-td>
      黑客松活动专区
    </lark-td>
    <lark-td>
      展示活动项目，支持人气票和榜单。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.7
    </lark-td>
    <lark-td>
      关注页面
    </lark-td>
    <lark-td>
      展示用户所关注的项目、founder的作品更新
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      3.5
    </lark-td>
    <lark-td>
      Founder管理页
    </lark-td>
    <lark-td>
      项目提交人作为该项目 Founder，可以查看自己项目的状态、数据、内测申请和用户评论。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      5.0
    </lark-td>
    <lark-td>
      运营后台
    </lark-td>
    <lark-td>
      运营可以管理项目、审核项目、配置活动、查看数据、处理异常。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      5.0
    </lark-td>
    <lark-td>
      项目审核/项目管理——运营后台
    </lark-td>
    <lark-td>
      运营可以审核项目是否能上线，并审核是否允许显示购买/支持入口。项目阶段由提交人自行选择，运营不重点判断项目阶段。
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      成熟产品支持入口
    </lark-td>
    <lark-td>
      通过购买审核的项目，可以显示外部购买链接或支持意向登记入口。
      一期暂不支持购买申请。
    </lark-td>
    <lark-td>
      P1
    </lark-td>
  </lark-tr>
</lark-table>

### 3.需求详情

### 3.1登录注册模块

#### 目标

登录注册模块用于识别用户身份。

用户在浏览首页、项目列表、项目详情页时，可以不登录（此时用户身份为“游客”）；当用户要进行投票、点赞、关注、申请内测、提交评论、提交项目等动作时，系统要求用户先登录（登录后为“登录用户”）。

本版本采用手机号验证码登录。

#### 涉及角色

<lark-table rows="5" cols="3" column-widths="114,128,334">

  <lark-tr>
    <lark-td>
      **角色** {align="center"}
    </lark-td>
    <lark-td>
      **是否使用该模块** {align="center"}
    </lark-td>
    <lark-td>
      **说明** {align="center"}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      游客
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      游客触发需登录动作时，系统弹出登录弹窗
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td rowspan="2">
      登录用户
    </lark-td>
    <lark-td rowspan="2">
      是
    </lark-td>
    <lark-td>
      登录后可投票、点赞、关注、申请内测、提交评论
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      登录后可提交项目、查看项目数据，此类用户又被称作“Founder”
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营管理员
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      运营后台登录可单独设计，不纳入本模块
    </lark-td>
  </lark-tr>
</lark-table>

#### 登录注册功能入口

当用户为“未登录状态”下点击如下入口后生效

<lark-table rows="3" cols="3" column-widths="184,222,311">

  <lark-tr>
    <lark-td>
      **入口场景** {align="center"}
    </lark-td>
    <lark-td>
      **触发方式** {align="center"}
    </lark-td>
    <lark-td>
      **登录成功后去向** {align="center"}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      顶部导航
    </lark-td>
    <lark-td>
      用户点击“登录”
    </lark-td>
    <lark-td>
      回到当前页面
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      其他需要登录才能使用的功能，当游客用户未登录点击后
    </lark-td>
    <lark-td>
      用户点击“XX”时
      <quote-container>
      “XX”操作包括：点赞、关注、
      </quote-container>
    </lark-td>
    <lark-td>
      回到当前页面并完成对应的操作
      <quote-container>
      示例：游客用户点击“点赞”，弹出登录弹窗，用户成功登录后，自动完成点赞。
      </quote-container>
    </lark-td>
  </lark-tr>
</lark-table>

#### 登录注册功能

##### 页面状态

<lark-table rows="2" cols="2" header-row="true" column-widths="310,407">

  <lark-tr>
    <lark-td>
      页面
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      <image token="CXHCbvMLkoISLnxfmSCcCQZYnVe" width="1686" height="1298" align="center"/>
    </lark-td>
    <lark-td>
      - 登录注册采用弹窗形式。
      - 弹窗居中显示。
      - 弹窗打开后，页面背景变暗。
      - 用户点击弹窗右上角关闭按钮，可以关闭登录弹窗。
      - 用户点击弹窗外部区域，可以关闭登录弹窗。
      - 用户关闭弹窗后，原本触发的动作（如点赞等操作）不执行。
    </lark-td>
  </lark-tr>
</lark-table>

##### 页面字段说明

<lark-table rows="7" cols="5" header-row="true" column-widths="133,78,78,513,298">

  <lark-tr>
    <lark-td>
      **字段** {align="center"}
    </lark-td>
    <lark-td>
      **类型** {align="center"}
    </lark-td>
    <lark-td>
      **是否必填** {align="center"}
    </lark-td>
    <lark-td>
      **规则** {align="center"}
    </lark-td>
    <lark-td>
      **占位文案** {align="center"}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      国家/地区码
    </lark-td>
    <lark-td>
      选择项
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      1.0默认中国大陆+86，不开放切换
      后续版本支持下拉框选择不同国家地区
    </lark-td>
    <lark-td>
      +86
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      手机号
    </lark-td>
    <lark-td>
      输入框
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      1. 手机号输入框仅允许输入数字。只允许唤醒数字键盘。
      1. 手机号最多允许输入11位。手机号不足11位时，“获取验证码”按钮置灰。
      1. 手机号不符合中国大陆手机号格式时，点击“获取验证码”后toast提示：`请输入正确的手机号`。
    </lark-td>
    <lark-td>
      请输入手机号
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      验证码
    </lark-td>
    <lark-td>
      输入框
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      **验证码发送规则**
      1. 验证码为6位数字。
      1. 验证码有效期为5分钟。
      1. 同一手机号60秒内只能发送1次验证码。获取验证码的按钮显示60s倒计时。
      1. 同一手机号1小时内最多发送5次验证码。
      1. 用户重新发送验证码后，旧验证码立即失效。
      1. 验证码仅用于登录注册。
      1. 验证码短信文案为：
      `你的验证码是123456，5分钟内有效。请勿转发给他人。`
      **验证码校验规则**
      1. 用户输入验证码后，系统不自动提交。
      1. 用户点击“登录”后，系统开始校验验证码。
      1. 当验证码正确且未过期时，登录成功。
      1. 当验证码校验失败时，登录失败，系统提示：`手机号或验证码错误，请重新输入`。
      1. 用户连续输错5次验证码后，当前设备锁定1小时。获取验证码的按钮显示60分钟倒计时。登录按钮置灰。
      1. 用户更换手机号后，验证码错误次数按新手机号重新计算。
    </lark-td>
    <lark-td>
      请输入6位验证码
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      获取验证码
    </lark-td>
    <lark-td>
      按钮
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      1. 当手机号为空或不足11位时，“获取验证码”按钮置灰，按钮文案显示为：`获取验证码`。
      1. 当手机号格式正确时，“获取验证码”按钮可点击，按钮文案显示为：`获取验证码`。
      1. 当验证码发送中/成功后，按钮进入倒计时状态，按钮置灰，按钮文案显示为：`59s后重发`。
      1. 当倒计时结束后，按钮恢复可点击状态，按钮文案显示为：`获取验证码`。
      1. 当达到验证码发送上限时，按钮置灰，按钮文案显示为：
        1. 倒计时大于1min，显示`60min后再试`。
        1. 倒计时小于1min，显示`60s后再试`。
    </lark-td>
    <lark-td>
      获取验证码
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      用户协议勾选
    </lark-td>
    <lark-td>
      勾选框
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      未勾选时不能完成登录
    </lark-td>
    <lark-td>
      我已阅读并同意《用户协议》和《隐私政策》
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      登录
    </lark-td>
    <lark-td>
      按钮
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      1. 手机号、验证码、协议均满足后可点击。
      1. 未注册过的手机号，点击登录后直接注册并登录。
      1. 登录成功后，登录态保持30天。
      1. 登录按钮状态
        1. 手机号不足11位/验证码不足6位/未勾选协议，三者任一发生，则按钮置灰
        1. 若验证码校验失败，则点击后弹toast`手机号或验证码错误，请重新输入`。
        1. 网络异常/服务异常弹toast：网络异常，请稍后再试！/服务异常，请稍后再试！
        1. 账号封禁弹toast：账号状态异常，请联系平台处理
    </lark-td>
    <lark-td>
      登录
    </lark-td>
  </lark-tr>
</lark-table>

#### 退出登录功能

1. 入口：导航栏点击用户头像
1. 展开账号菜单
  1. <text color="red" bgcolor="light-yellow">菜单选项待定</text>

<image token="YLxFbFIy3op7r5x3uzkc1SS2nMd" width="2916" height="1558" align="left"/>

1. 用户点击“退出登录”
1. 页面居中显示确认退出弹窗
  1. 点击“X”/点击弹窗外部区域/点击“取消”可关闭弹窗，回到原先页面
  1. 点击确认则退出登录态，并回到原先页面

<image token="OHTLb3YwYoke0RxKhLjc7PeOnbh" width="1024" height="1024" align="left"/>

#### 数据记录

登录注册模块需要记录以下数据：

<lark-table rows="10" cols="3" column-widths="199,286,100">

  <lark-tr>
    <lark-td>
      **数据项** {align="center"}
    </lark-td>
    <lark-td>
      **说明** {align="center"}
    </lark-td>
    <lark-td>
      优先级
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      user_id
    </lark-td>
    <lark-td>
      用户唯一ID
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      phone
    </lark-td>
    <lark-td>
      注册手机号
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      register_time
    </lark-td>
    <lark-td>
      首次登录时间
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      last_login_time
    </lark-td>
    <lark-td>
      最近登录时间
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      login_source
    </lark-td>
    <lark-td>
      登录触发来源，如投票、内测、顶部导航
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      device_id
    </lark-td>
    <lark-td>
      设备标识
    </lark-td>
    <lark-td>
      P3
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      ip
    </lark-td>
    <lark-td>
      登录IP
    </lark-td>
    <lark-td>
      P3
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      login_fail_count
    </lark-td>
    <lark-td>
      登录失败次数
    </lark-td>
    <lark-td>
      P3
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      account_status
    </lark-td>
    <lark-td>
      正常、封禁、注销（1.0没有注销）
    </lark-td>
    <lark-td>
      P0
    </lark-td>
  </lark-tr>
</lark-table>

### 3.2项目提交模块

#### 目标

项目提交模块用于让登录用户向平台提交自己的作品。

用户填写项目资料、上传 Demo、选择项目阶段后，可以保存草稿或提交审核。项目提交后，平台进入审核流程；审核通过后，项目才可以在前台展示。

所有登录用户都可以提交项目。用户提交项目后，即成为该项目的 Founder。

#### 限制

同一用户可以提交多个项目。至多<text color="red" bgcolor="light-yellow">**X**</text>个。

一个项目默认只有一个 Founder。<text bgcolor="light-yellow">**后续如果需要多人协作，可再增加协作者机制，本期先不做。**</text>

#### 涉及角色

<lark-table rows="4" cols="2" column-widths="114,522">

  <lark-tr>
    <lark-td>
      **角色** {align="center"}
    </lark-td>
    <lark-td>
      **说明** {align="center"}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      游客
    </lark-td>
    <lark-td>
      游客可以浏览平台内容，但不能提交项目。
      当游客点击“提交项目”时，系统弹出登录弹窗。游客完成登录后，系统进入项目提交页。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td rowspan="2">
      登录用户
    </lark-td>
    <lark-td>
      登录用户可以提交项目、保存草稿、提交审核。
      登录用户创建项目草稿后，系统将该用户绑定为该项目 Founder。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      用户提交项目后，成为该项目 Founder。Founder 可以查看、编辑和管理自己提交的项目，但不能直接修改项目审核状态。
    </lark-td>
  </lark-tr>
</lark-table>

#### 项目提交功能入口

<lark-table rows="5" cols="2" header-row="true" column-widths="492,302">

  <lark-tr>
    <lark-td>
      入口位置
    </lark-td>
    <lark-td>
      原型参考
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      首页顶部导航栏展示“提交项目”入口。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      ~~首页项目列表区域展示“提交项目”入口。~~
    </lark-td>
    <lark-td>
      <text color="red" bgcolor="light-yellow">?</text>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      用户登录后的个人菜单中展示“我的项目”入口，进入后可继续提交新项目。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      黑客松活动专区可展示“提交参赛项目”入口。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
</lark-table>

#### 项目提交功能

##### 页面——原型图

注：部分开关打开后，可能会展开更多待填信息

<image token="S2ZPbijhfodRRgxVWYLcFzw5n9g" width="794" height="1951" align="left"/>

##### 页面字段说明

<lark-table rows="33" cols="5" header-row="true" column-widths="117,145,137,385,256">

  <lark-tr>
    <lark-td>
      区域
    </lark-td>
    <lark-td>
      字段名称
    </lark-td>
    <lark-td>
      填写要求
    </lark-td>
    <lark-td>
      说明/限制
    </lark-td>
    <lark-td>
      原型
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **基础信息区**
    </lark-td>
    <lark-td>
      项目名称
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      长度限制：2-30个中文字符，或2-60个英文字符。
      占位文案：`请输入项目名称`
      - 项目名称长度不符合要求时，字段下方提示：`项目名称需为2-30个中文字符`。
    </lark-td>
    <lark-td rowspan="6">
      <image token="Wv3obIZX7ots3Bxv1vQcBeVUnmg" width="996" height="284" align="center"/>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      一句话介绍
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      用于项目卡片和详情页顶部展示。
      长度限制：10-40个中文字符。
      占位文案：`用一句话说明这个项目解决什么问题`
      一句话介绍长度不符合要求时，字段下方提示：`一句话介绍需为10-40个中文字符`。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      项目品类
    </lark-td>
    <lark-td>
      必填（可多选）
    </lark-td>
    <lark-td>
      候选项：<text color="red" bgcolor="light-yellow">女性健康、</text><text color="red" bgcolor="light-yellow">~~AI硬件、AI软件~~</text><text color="red" bgcolor="light-yellow">、效率工具、教育、创作者工具、其他</text>。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      项目形态
    </lark-td>
    <lark-td>
      必填（单选）
    </lark-td>
    <lark-td>
      硬件、软件、软硬件结合
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      项目阶段
    </lark-td>
    <lark-td>
      必填（单选）
    </lark-td>
    <lark-td>
      候选项：MVP阶段、<text color="red" bgcolor="light-yellow">成长阶段</text>。
      说明：MVP阶段表示早期验证；成长阶段表示已有测试版本、测试名额等。
      仅用于前台展示，不决定购买/支持入口。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      所属活动
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      **若从活动入口进入则系统默认带入，用户不可修改。**
      页面提供当前活动选项，用户不填则为无。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **展示资料区**
    </lark-td>
    <lark-td>
      项目封面
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      支持 jpg、png、webp，单张不超过<text color="red" bgcolor="light-yellow">5MB</text>，建议比例 <text color="red" bgcolor="light-yellow">16:9</text>。
      用于**首页卡片、列表及详情页顶部**展示。
      图片超过5MB或其他不符合要求，toast显示：`图片上传失败，请重新上传`。
    </lark-td>
    <lark-td rowspan="4">
      <image token="UdgAbkWuAotEwLxNINIcFGEUn6c" width="994" height="398" align="center"/>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      Demo 图片
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      最多上传<text color="red" bgcolor="light-yellow">X</text>张，单张不超过<text color="red" bgcolor="light-yellow">5MB</text>。
      用于详情页展示界面、硬件、场景或效果图。
      图片超过5MB或其他不符合要求，toast显示：`图片上传失败，请重新上传`。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      Demo 视频
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      支持上传视频（单个≤<text color="red" bgcolor="light-yellow">200MB</text>）或填写视频链接（需为合法URL）。
      视频超过200MB或其他不符合要求，toast显示：`视频上传失败，请重新上传`。
      ~~链接格式错误时，字段下方显示：~~`~~请输入正确的链接~~`~~。~~
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      Demo 访问链接
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      用于填写产品体验地址、原型地址、GitHub、Notion等链接。
      无可访问Demo可不填。
      链接格式错误时，字段下方显示：`请输入正确的链接`。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **项目说明区**
    </lark-td>
    <lark-td>
      项目介绍
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      最少<text color="red" bgcolor="light-yellow">100字</text>，最多<text color="red" bgcolor="light-yellow">2000字。</text>
      需说明项目是什么、解决什么问题、当前进度。
      项目介绍字数不符合需求时，显示：`项目介绍至少100字，至多2000字`。
    </lark-td>
    <lark-td rowspan="5">
      <image token="BjQObZfFHoSHE2xtVUucZIX3nUf" width="986" height="638" align="center"/>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      目标用户
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      最少20字，最多500字。
      需说明项目主要给谁用。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      用户问题
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      最少20字，最多500字。
      需说明目标用户现在遇到什么问题。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      当前进展
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      最少20字，最多500字。
      需说明项目目前状态（如已有原型/测试版/硬件样品等）。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      下一步计划
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      最多500字。
      用于说明项目接下来准备做什么。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      对用户说的话
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      展示在项目详情，给Founder和潜在用户交流的机会。
      Founder的广告位（bushi
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **用户参与设置区**
    </lark-td>
    <lark-td>
      是否开放内测
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      默认值：否。
      选择“是”且项目审核上线后，详情页会显示“申请内测”入口。
    </lark-td>
    <lark-td rowspan="3">
      <image token="AKgjbOCUBonKtKxSI8PcO6zVnJf" width="1788" height="644" align="center"/>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      ~~内测名额~~
    </lark-td>
    <lark-td>
      ~~条件必填~~
    </lark-td>
    <lark-td>
      ~~当“是否开放内测”为“是”时必填。~~
      ~~需为正整数，或选择“不限”。~~
      ~~内测名额不是正整数时，字段下方提示：~~`~~请输入正确的内测名额~~`~~。~~
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      内测说明
    </lark-td>
    <lark-td>
      条件必填
    </lark-td>
    <lark-td>
      当“是否开放内测”为“是”时必填。
      用于说明内测对象、测试方式、预计联系时间。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      <text color="red" bgcolor="light-yellow">**购买支持申请区**</text>
      <text bgcolor="light-purple">1.0先不做购买支持，这部分可以先隐藏</text>
    </lark-td>
    <lark-td>
      是否申请显示购买支持入口
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      默认值：否。
      选择“是”则需补充下方信息，且需运营单独审核。是否显示由运营审核结果决定。
    </lark-td>
    <lark-td rowspan="6">
      <image token="NOtfbAqzQoLiQBxJ6PhcBcKjnQh" width="1632" height="704" align="center"/>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      *（以下字段在申请显示入口时出现）*
    </lark-td>
    <lark-td>
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      <text color="red" bgcolor="light-yellow">交付说明</text>
    </lark-td>
    <lark-td>
      条件必填
    </lark-td>
    <lark-td>
      需说明用户支持或购买后预计获得什么。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      <text color="red" bgcolor="light-yellow">预计交付时间</text>
    </lark-td>
    <lark-td>
      条件必填
    </lark-td>
    <lark-td>
      可填写具体日期或时间范围。
      例如什么时候发货之类的。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      <text color="red" bgcolor="light-yellow">售后说明</text>
    </lark-td>
    <lark-td>
      条件必填
    </lark-td>
    <lark-td>
      需说明如何处理使用问题、售后咨询或交付异常。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      <text color="red" bgcolor="light-yellow">退款说明</text>
    </lark-td>
    <lark-td>
      条件必填
    </lark-td>
    <lark-td>
      需说明是否支持退款及退款条件。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **联系信息区**
    </lark-td>
    <lark-td>
      联系人姓名
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      仅平台后台可见，前台不展示。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      联系手机号
    </lark-td>
    <lark-td>
      必填
    </lark-td>
    <lark-td>
      默认带入登录手机号，可修改。仅平台后台可见。
      联系手机号格式错误时，字段下方提示：`请输入正确的手机号`。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      联系邮箱
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      仅平台后台可见，前台不展示。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      微信号
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      仅平台后台可见，前台不展示。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      团队名称
    </lark-td>
    <lark-td>
      选填
    </lark-td>
    <lark-td>
      若填写，可在项目详情页展示；不填则前台展示用户昵称或提交人名称。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **底部操作区**
    </lark-td>
    <lark-td>
      保存草稿
    </lark-td>
    <lark-td>
      点击触发
    </lark-td>
    <lark-td>
      - 校验最小必填字段：项目名称。
        - 若项目名称为空，系统不保存草稿，提示：`请先填写项目名称。`
      - 保存成功后创建项目草稿，提示：`草稿已保存。`首次保存草稿将当前用户绑定为项目 Founder。
        - 草稿状态不进入运营审核，不在前台展示
        - Founder 可在"我的项目"中继续编辑草稿。
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      提交审核
    </lark-td>
    <lark-td>
      点击触发
    </lark-td>
    <lark-td>
      - 校验全部必填字段。
        - 若有未填写字段，系统不提交审核，并定位到第一个未填写的必填字段，在字段下方显示错误提示：`请补全必填信息`
      - 全部必填字段填写完成后可提交审核。提交成功后提示：`已提交审核，请等待平台处理`
        - 提交成功后项目状态变为`待审核`，前台不展示。
      Founder 可查看项目信息，但不能直接修改已提交内容。
        - 如需修改，Founder 可撤回审核（**本期暂不支持撤回**）
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
</lark-table>

- 需求点：项目状态流转逻辑

<lark-table rows="11" cols="6" header-row="true" column-widths="174,225,162,241,220,394">

  <lark-tr>
    <lark-td>
      操作/事件
    </lark-td>
    <lark-td>
      触发条件
    </lark-td>
    <lark-td>
      触发后项目状态
    </lark-td>
    <lark-td>
      按钮状态变化
    </lark-td>
    <lark-td>
      Toast 提示
    </lark-td>
    <lark-td>
      校验规则与错误提示
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      保存草稿
    </lark-td>
    <lark-td>
      用户点击「保存草稿」
    </lark-td>
    <lark-td>
      草稿
    </lark-td>
    <lark-td>
      「保存草稿」按钮置灰；文案变为「保存中」；完成后恢复
    </lark-td>
    <lark-td>
      成功则提示：草稿已保存
    </lark-td>
    <lark-td>
      项目名称为空：不保存，提示「请先填写项目名称」
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      提交审核
    </lark-td>
    <lark-td>
      用户点击「提交审核」
    </lark-td>
    <lark-td>
      待审核
    </lark-td>
    <lark-td>
      「提交审核」按钮置灰，文案变为「提交中」；完成后恢复
    </lark-td>
    <lark-td>
      成功则提示：已提交审核，请等待平台处理
    </lark-td>
    <lark-td>
      校验全部必填字段，未填写完整：提示「请补全必填信息」，并定位到首个未填写字段
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营要求修改
    </lark-td>
    <lark-td>
      运营操作
    </lark-td>
    <lark-td>
      需修改
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      Founder 修改后再次提交
    </lark-td>
    <lark-td>
      用户点击「提交审核」
    </lark-td>
    <lark-td>
      待审核
    </lark-td>
    <lark-td colspan="3">
      **同"提交审核"事件**
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营审核通过
    </lark-td>
    <lark-td>
      运营操作
    </lark-td>
    <lark-td>
      已上线
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营拒绝
    </lark-td>
    <lark-td>
      运营操作
    </lark-td>
    <lark-td>
      已拒绝
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营下架项目
    </lark-td>
    <lark-td>
      运营操作
    </lark-td>
    <lark-td>
      已下架
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目审核中编辑
    </lark-td>
    <lark-td>
      用户尝试编辑待审核项目
    </lark-td>
    <lark-td>
      不变
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      项目审核中，暂时不能修改
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      网络异常
    </lark-td>
    <lark-td>
      提交/保存时
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      按钮恢复原状态
    </lark-td>
    <lark-td>
      网络异常，请稍后再试
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      服务异常
    </lark-td>
    <lark-td>
      提交/保存时
    </lark-td>
    <lark-td>
      —
    </lark-td>
    <lark-td>
      按钮恢复原状态
    </lark-td>
    <lark-td>
      服务异常，请稍后再试
    </lark-td>
    <lark-td>
      —
    </lark-td>
  </lark-tr>
</lark-table>

#### 数据记录

<lark-table rows="18" cols="2" header-row="true" column-widths="200,390">

  <lark-tr>
    <lark-td>
      数据字段
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      project_id
    </lark-td>
    <lark-td>
      项目唯一ID
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      user_id
    </lark-td>
    <lark-td>
      项目提交人用户ID
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      project_name
    </lark-td>
    <lark-td>
      项目名称
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      project_stage
    </lark-td>
    <lark-td>
      项目阶段，MVP阶段或成长阶段
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      category
    </lark-td>
    <lark-td>
      项目品类
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      project_status
    </lark-td>
    <lark-td>
      项目状态
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      cover_image_url
    </lark-td>
    <lark-td>
      项目封面
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      demo_asset_urls
    </lark-td>
    <lark-td>
      Demo图片或视频地址
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      demo_link
    </lark-td>
    <lark-td>
      Demo访问链接
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      is_open_for_test
    </lark-td>
    <lark-td>
      是否开放内测
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      is_feedback_enabled
    </lark-td>
    <lark-td>
      是否允许用户评论
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      purchase_request_status
    </lark-td>
    <lark-td>
      购买支持申请状态
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      contact_name
    </lark-td>
    <lark-td>
      联系人姓名
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      contact_phone
    </lark-td>
    <lark-td>
      联系人手机号
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      created_at
    </lark-td>
    <lark-td>
      创建时间
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      updated_at
    </lark-td>
    <lark-td>
      更新时间
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      submitted_at
    </lark-td>
    <lark-td>
      提交审核时间
    </lark-td>
  </lark-tr>
</lark-table>

### 3.3项目详情模块

#### 目标

项目详情页用于向用户展示单个项目的完整信息，并承接点赞、关注（关注用户）、投票、评论、申请内测、购买等动作。

#### 限制

- 只有状态为 `已上线` 的项目，会在首页/项目列表页展示项目卡片，从而进一步访问详情页。
- 状态为 `草稿`、`待审核`、`需修改`、`已拒绝`、`已下架` 的项目，普通用户不可访问。Founder可在对应页面查看自己的项目。
- 兜底处理，如果用户访问到已下架项目链接，系统显示空状态页：
  <image token="Y1gNb7xpSoO5JRxNa9ncOhphnRc" width="1262" height="572" align="left"/>

  - 标题：`项目暂不可查看`
  - 说明：`该项目当前未在平台展示。`
  - 按钮：`返回首页`

#### 涉及角色

<lark-table rows="4" cols="2" column-widths="114,522">

  <lark-tr>
    <lark-td>
      **角色** {align="center"}
    </lark-td>
    <lark-td>
      **说明** {align="center"}
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      游客
    </lark-td>
    <lark-td>
      游客可以浏览平台内容，但不能进行其他点击操作，点击将触发需登录动作时，系统弹出登录弹窗，登录完成后，对应的操作完成，并回到该页面。
      游客可以点击分享按钮分享项目。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td rowspan="2">
      登录用户
    </lark-td>
    <lark-td>
      登录用户可以分享、点赞、关注（关注用户）、投票、评论、申请内测、购买等动作。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      Founder 可以分享、点赞、投票、购买、评论自己账号绑定的项目；但不能关注（自己账号）、申请内测。
      Founder评论自己项目时，需要带上“Founder”标识，标注出这是这个作品的创作者。
    </lark-td>
  </lark-tr>
</lark-table>

#### 项目详情模块入口

首页/项目列表页或黑客松活动页面的项目卡片的“<text color="red" bgcolor="light-yellow">项目详情</text>”按钮或者**卡片任意位置**。

#### 项目详情功能

##### 页面

<image token="YEbdbpF2soLQbaxfKDXc2bLKnKg" width="1496" height="1426" align="center"/>

###### 页面展示内容

- 项目基础信息
  - 项目名称
  - 一句话介绍
  - 项目品类
  - 项目阶段：`MVP阶段` / <text color="red" bgcolor="light-yellow">`成长阶段`</text>
  - 所属活动：如果没有活动，则不展示
  - 上线时间
- 项目资料
  - 项目封面
  - Demo图片/视频
  - Demo访问链接
  - 项目介绍
  - 适合用户
  - 当前进展
  - 想对你说——<text color="red">建议放在比较显著的位置</text>
- 项目数据
  - 点赞数
  - ~~关注数~~
  - 投票数
  - 浏览量
  - 评论数
  - 分享量
- Founder信息
  - Founder头像
  - Founder昵称
  - Founder简介
  - Founder等级：**1.0没有等级体系，可先不展示**
  - ~~Founder历史项目数：~~~~**可后续再做**~~
  - 获得的关注量
- 按钮

<lark-table rows="14" cols="6" header-row="true" column-widths="133,133,200,200,200,200">

  <lark-tr>
    <lark-td>
      按钮类型
    </lark-td>
    <lark-td>
      功能/按钮
    </lark-td>
    <lark-td>
      展示条件
    </lark-td>
    <lark-td>
      交互规则
    </lark-td>
    <lark-td>
      字段/内容
    </lark-td>
    <lark-td>
      异常/限制说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      通用按钮
    </lark-td>
    <lark-td>
      点赞
    </lark-td>
    <lark-td>
      所有已上线项目
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→已点赞状态，点赞数+1
      再次点击→取消点赞，点赞数-1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      通用按钮
    </lark-td>
    <lark-td>
      关注
    </lark-td>
    <lark-td>
      所有已上线项目
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→已关注状态，关注数+1
      再次点击→取消关注，关注数-1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      通用按钮
    </lark-td>
    <lark-td>
      投票
    </lark-td>
    <lark-td>
      所有已上线项目
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→投票数+1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      同一用户同一项目仅可投票1次
      已投票再次点击→toast提示"`你已经投过票了`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      通用按钮
    </lark-td>
    <lark-td>
      人气
    </lark-td>
    <lark-td>
      黑客松页面的活动项目
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→人气+1
    </lark-td>
    <lark-td>
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      通用按钮
    </lark-td>
    <lark-td>
      分享
    </lark-td>
    <lark-td>
      所有已上线项目
    </lark-td>
    <lark-td>
      点击→复制当前详情页链接
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      分享成功→toast提示"`链接已复制`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      查看Demo
    </lark-td>
    <lark-td>
      Founder填写了Demo链接
    </lark-td>
    <lark-td>
      点击→新窗口打开Demo链接
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      Demo链接为空→不展示按钮
      Demo链接无法打开→toast提示"`链接异常，暂时无法打开`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      提交评论
    </lark-td>
    <lark-td>
      始终展示
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→打开反馈弹窗
    </lark-td>
    <lark-td>
      <image token="K8SZbC33loThjTxxNQtcGi14nfb" width="880" height="1058" align="center"/>
      反馈类型选择：问题反馈、功能建议、使用感受、其他
      反馈内容：必填，最多500字
      是否愿意被Founder联系：是/否【默认勾选否】
      联系方式：上一选项填“是”时展示
    </lark-td>
    <lark-td>
      提交成功→toast提示"`反馈已提交`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
    </lark-td>
    <lark-td>
      申请内测
    </lark-td>
    <lark-td>
      项目开启内测申请
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→打开内测申请弹窗
    </lark-td>
    <lark-td>
      <image token="Ls4mbjW1SoR74nxF9YwcxfB8nie" width="556" height="522" align="center"/>
      申请理由：<text color="red" bgcolor="light-yellow">选填</text>，最多300字联系方式：必填
    </lark-td>
    <lark-td>
      项目未开启内测→不展示按钮
      同一用户同一项目仅可提交1次
      已申请再次点击→toast提示"`你已提交过内测申请`"
      提交成功→toast提示"`内测申请已提交`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      购买支持
      <text bgcolor="light-purple">1.0先不做购买支持，这部分逻辑后面再完善</text>
    </lark-td>
    <lark-td>
      购买区
    </lark-td>
    <lark-td>
      Founder开启购买并审核通过
    </lark-td>
    <lark-td>
      点击立即支持→进入平台支付流程
    </lark-td>
    <lark-td>
      支持项项目名称、价格、交付说明、售后说明、收货地址、收件人联系方式、立即支持按钮
    </lark-td>
    <lark-td>
      Founder未开启→不展示购买区，不展示任何提示
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      购买支持
    </lark-td>
    <lark-td>
      立即支持
    </lark-td>
    <lark-td>
      购买区展示时
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗
      登录后点击→进入平台支付流程
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      支付成功→toast提示"`支持成功`"
      支付失败→toast提示"`支付未完成，请重试`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      页面异常
    </lark-td>
    <lark-td>
      用户未登录
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      可浏览项目详情
      点击按钮时弹出登录弹窗
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      页面异常
    </lark-td>
    <lark-td>
      项目已下架
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      普通用户不可继续查看
    </lark-td>
    <lark-td>
      展示"项目暂不可查看"
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      页面异常
    </lark-td>
    <lark-td>
      Demo链接无法打开
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      新窗口打开失败→toast提示"`链接异常，暂时无法打开`"
    </lark-td>
  </lark-tr>
</lark-table>

### 3.4用户互动模块

#### 目标

用于记录用户对项目的兴趣、支持意愿和具体意见，包括点赞、关注、投人气票、分享项目、提交反馈。该模块的数据提供给项目展示、Founder后台和运营后台使用。

#### 用户互动入口

<lark-table rows="4" cols="2" header-row="true" column-widths="232,200">

  <lark-tr>
    <lark-td>
      页面
    </lark-td>
    <lark-td>
      对应功能按钮
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      首页项目列表页/
    </lark-td>
    <lark-td>
      点赞、关注、分享
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      活动（黑客松）专区项目卡片
    </lark-td>
    <lark-td>
      投人气、关注、分享
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目详情页
    </lark-td>
    <lark-td>
      点赞/投人气、关注、分享、提交反馈
    </lark-td>
  </lark-tr>
</lark-table>

#### 功能交互

<lark-table rows="8" cols="8" header-row="true" column-widths="200,200,200,200,200,200,200,200">

  <lark-tr>
    <lark-td>
      功能
    </lark-td>
    <lark-td>
      页面范围
    </lark-td>
    <lark-td>
      操作
    </lark-td>
    <lark-td>
      状态变化
    </lark-td>
    <lark-td>
      数量变化
    </lark-td>
    <lark-td>
      Toast提示
    </lark-td>
    <lark-td>
      特殊限制
    </lark-td>
    <lark-td>
      补充规则
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      点赞
    </lark-td>
    <lark-td>
      首页项目列表页/活动专区项目卡片
      项目详情页
    </lark-td>
    <lark-td>
      点击点赞
    </lark-td>
    <lark-td>
      按钮变为"已点赞"
    </lark-td>
    <lark-td>
      点赞数+1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      同一用户同一项目最多1条有效点赞记录
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      点赞
    </lark-td>
    <lark-td>
      首页项目列表页/活动专区项目卡片
      项目详情页
    </lark-td>
    <lark-td>
      再次点击已点赞
    </lark-td>
    <lark-td>
      按钮恢复为"点赞"
    </lark-td>
    <lark-td>
      点赞数-1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      关注
    </lark-td>
    <lark-td>
      首页项目列表页/活动专区项目卡片
      项目详情页
    </lark-td>
    <lark-td>
      点击关注
    </lark-td>
    <lark-td>
      按钮变为"已关注"
    </lark-td>
    <lark-td>
      关注数+1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      同一用户同一项目最多1条有效关注记录
    </lark-td>
    <lark-td>
      关注后可在"我的关注"中查看到所关注的用户
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      关注
    </lark-td>
    <lark-td>
      首页项目列表页/活动专区项目卡片
      项目详情页
    </lark-td>
    <lark-td>
      再次点击已关注
    </lark-td>
    <lark-td>
      按钮恢复为"关注"
    </lark-td>
    <lark-td>
      关注数-1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      投人气
    </lark-td>
    <lark-td>
      首页项目列表页/活动专区项目卡片
      项目详情页
    </lark-td>
    <lark-td>
      点击按钮
    </lark-td>
    <lark-td>
      按钮变为"已投"
    </lark-td>
    <lark-td>
      人气+1
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      同一用户同一项目仅可投1次
      票不可取消
    </lark-td>
    <lark-td>
      已投票再次点击→toast提示"`你已经投过票了`"
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      分享
    </lark-td>
    <lark-td>
      首页项目列表页/活动专区项目卡片
      项目详情页
    </lark-td>
    <lark-td>
      点击分享
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      统计分享次数
    </lark-td>
    <lark-td>
      链接已复制
    </lark-td>
    <lark-td>
      分享不强制登录
      同一用户/设备多次分享可重复计数
      分享不影响点赞、关注、人气票数据
    </lark-td>
    <lark-td>
      **若浏览器不支持自动复制→显示分享弹窗，包含：项目链接、复制链接按钮**
      <image token="IRwJbLmqvoJGzExsqHdcjNL3n6b" width="508" height="268" align="center"/>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      提交评论
    </lark-td>
    <lark-td>
      项目详情页
    </lark-td>
    <lark-td>
      点击提交反馈
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
    </lark-td>
    <lark-td>
      未登录→弹出登录弹窗，登录成功后打开反馈弹窗
      用户可多次提交反馈
      评论内容需要接入<text color="red">机器审核</text>，通过才可在前台展示。
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
</lark-table>

~~评论提交弹窗字段~~

<image token="FTPmbdFbaoUsKgxWhAbcL0WOnMb" width="880" height="1058" align="left"/>

<lark-table rows="5" cols="5" header-row="true" column-widths="200,200,200,200,200">

  <lark-tr>
    <lark-td>
      ~~字段名称~~
    </lark-td>
    <lark-td>
      ~~字段名~~
    </lark-td>
    <lark-td>
      ~~是否必填~~
    </lark-td>
    <lark-td>
      ~~枚举值/限制~~
    </lark-td>
    <lark-td>
      ~~异常提示~~
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      ~~评论类型~~
    </lark-td>
    <lark-td>
      ~~comment_type~~
    </lark-td>
    <lark-td>
      ~~必填~~
    </lark-td>
    <lark-td>
      ~~问题反馈~~
      ~~功能建议~~
      ~~使用感受~~
      ~~其他~~
    </lark-td>
    <lark-td>
      ~~-~~
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      ~~评论内容~~
    </lark-td>
    <lark-td>
      ~~comment_content~~
    </lark-td>
    <lark-td>
      ~~必填~~
    </lark-td>
    <lark-td>
      ~~最多500字~~
    </lark-td>
    <lark-td>
      ~~为空时提示"请填写反馈内容"~~
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      ~~是否愿意被Founder联系~~
    </lark-td>
    <lark-td>
      ~~can_contact~~
    </lark-td>
    <lark-td>
      ~~非必填，默认"否"~~
    </lark-td>
    <lark-td>
      ~~是~~
      ~~否~~
    </lark-td>
    <lark-td>
      ~~-~~
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      ~~联系方式~~
    </lark-td>
    <lark-td>
      ~~contact_info~~
    </lark-td>
    <lark-td>
      ~~条件展示（选"是"时展示）~~
      ~~条件必填~~
    </lark-td>
    <lark-td>
      ~~-~~
    </lark-td>
    <lark-td>
      ~~为空时提示"请填写联系方式"~~
    </lark-td>
  </lark-tr>
</lark-table>

### 3.5Founder后台模块（名字待定）

#### 目标

Founder后台用于让项目提交者查看自己项目的状态、数据和待处理事项。1.0版本先做最小可用后台，不区分复杂权限；用户只要提交过项目，就可以进入Founder后台查看自己的项目。

#### Founder后台入口

1. 用户登录后，页面右上角展示入口：`Founder后台`。
1. 用户点击 `Founder后台` 后，系统判断该用户是否提交过项目。
1. 如果用户提交过至少1个项目，进入Founder后台。
1. 如果用户未提交过项目，显示空状态页：
  1. 标题：`你还没有提交项目`
  1. 说明：`提交项目后，可以在这里查看审核状态、项目数据和用户反馈。`
  1. 按钮：`提交项目`/`返回首页`

<image token="RsrKbCh1Wou72RxZho8c2ZMmnIf" width="556" height="460" align="left"/>

#### Founder后台页面

##### 菜单

我的项目

项目数据（1期不做，展示兜底空页面/或隐藏该tab）

用户评论（1期不做，展示兜底空页面/或隐藏该tab）

内测申请（1期不做，展示兜底空页面/或隐藏该tab）

购买订单（1期不做，展示兜底空页面/或隐藏该tab）

##### 我的项目页面（1.0默认进入）

页面目标：我的项目页用于展示当前用户提交过的所有项目，并让用户快速知道每个项目现在处于什么状态、还需要做什么。

页面布局：

- 页面顶部标题：我的项目
- 项目总览
  - 展示：累计项目数量、已上线项目数量、待审核项目数量、累计金额
- 搜索框：支持按关键词搜索项目名称/一句话介绍
- 可筛选项目状态：全部、待审核、需修改、已上线、已下架、已拒绝
- 可筛选项目阶段：全部、MVP、成长阶段
- 项目卡片（详情见下）

###### 项目卡片展示字段

<lark-table rows="15" cols="2" header-row="true" column-widths="200,440">

  <lark-tr>
    <lark-td>
      字段名称
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目封面
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目名称
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      一句话介绍
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目阶段
    </lark-td>
    <lark-td>
      枚举值：MVP阶段、成长阶段
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目状态
    </lark-td>
    <lark-td>
      枚举值：草稿、待审核、需修改、已上线、已拒绝、已下架
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      **创建时间**
    </lark-td>
    <lark-td>
      首次创建项目的时间
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      最近更新时间
    </lark-td>
    <lark-td>
      最新修改/提交等操作的时间
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      点赞数
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      关注数
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      人气数
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      评论数
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      内测申请数
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      支持订单数
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      支持金额
    </lark-td>
    <lark-td>
      -
    </lark-td>
  </lark-tr>
</lark-table>

###### 项目状态及按钮展示

<lark-table rows="7" cols="7" header-row="true" column-widths="93,200,142,200,249,200,200">

  <lark-tr>
    <lark-td>
      项目状态
    </lark-td>
    <lark-td>
      含义
    </lark-td>
    <lark-td>
      前台是否展示
    </lark-td>
    <lark-td>
      Founder是否可编辑
    </lark-td>
    <lark-td>
      主要按钮
    </lark-td>
    <lark-td>
      状态提示文案
    </lark-td>
    <lark-td>
      编辑权限说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      草稿
    </lark-td>
    <lark-td>
      Founder已保存项目资料，但还没有提交审核
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      继续编辑——>进入编辑页面
    </lark-td>
    <lark-td>
      项目还未提交审核，完善资料后可以提交。
    </lark-td>
    <lark-td>
      可以编辑全部字段
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      待审核
    </lark-td>
    <lark-td>
      Founder已提交项目，等待运营审核
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      查看项目——>进入编辑页面，但“提交审核”和“保存草稿”的按钮置灰，单击按钮后提示：`审核中暂不可修改`
    </lark-td>
    <lark-td>
      项目正在审核中，审核完成后会更新状态。
    </lark-td>
    <lark-td>
      不可编辑
      1.0版本暂不支持撤回提交
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      需修改
    </lark-td>
    <lark-td>
      运营认为资料不完整或不符合展示要求等，Founder需要修改后重新提交
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      查看修改意见
      修改项目
    </lark-td>
    <lark-td>
      项目需要修改后重新提交。
    </lark-td>
    <lark-td>
      可以编辑全部字段
      修改后需重新提交审核
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      已上线
    </lark-td>
    <lark-td>
      项目已通过审核，正在前台展示
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      限制编辑
    </lark-td>
    <lark-td>
      查看项目——>进入编辑页面
      查看数据——>跳转tab项目数据
      查看评论——>跳转tab用户评论
      查看内测申请——>跳转tab内测申请
      查看购买订单——>跳转tab购买订单
    </lark-td>
    <lark-td>
      项目正在前台展示，用户可以浏览和互动。
    </lark-td>
    <lark-td>
      1.0版本仅允许编辑：项目详细说明、Demo访问链接、内测说明、购买/支持说明
      修改后需要运营重新审核
      审核期间旧版本继续展示
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      已拒绝
    </lark-td>
    <lark-td>
      项目未通过审核，暂不允许上线
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      查看拒绝原因
    </lark-td>
    <lark-td>
      项目未通过审核，当前不能上线。
    </lark-td>
    <lark-td>
      不可编辑
      不允许重新提交
      如需重新提交需新建项目
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      已下架
    </lark-td>
    <lark-td>
      项目曾经上线，但当前不再前台展示
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      查看下架原因
      查看历史数据
    </lark-td>
    <lark-td>
      项目已下架，普通用户当前不可查看。
    </lark-td>
    <lark-td>
      不可编辑
    </lark-td>
  </lark-tr>
</lark-table>

###### 查看弹窗

<image token="S2Ggb8KQwou3epxwIQqcjAYcngd" width="1046" height="350" align="left"/>

<lark-table rows="4" cols="5" header-row="true" column-widths="200,200,200,220,200">

  <lark-tr>
    <lark-td>
      按钮名称
    </lark-td>
    <lark-td>
      弹窗标题
    </lark-td>
    <lark-td>
      展示内容
    </lark-td>
    <lark-td>
      置底提示
    </lark-td>
    <lark-td>
      按钮
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      查看修改意见
    </lark-td>
    <lark-td>
      修改意见
    </lark-td>
    <lark-td>
      运营填写的原因
    </lark-td>
    <lark-td>
      问题反馈联系邮箱
    </lark-td>
    <lark-td>
      我知道了
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      查看拒绝原因
    </lark-td>
    <lark-td>
      拒绝原因
    </lark-td>
    <lark-td>
      运营填写的原因
    </lark-td>
    <lark-td>
      问题反馈联系邮箱
    </lark-td>
    <lark-td>
      我知道了
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      查看下架原因
    </lark-td>
    <lark-td>
      下架原因
    </lark-td>
    <lark-td>
      运营填写的原因
    </lark-td>
    <lark-td>
      问题反馈联系邮箱
    </lark-td>
    <lark-td>
      我知道了
    </lark-td>
  </lark-tr>
</lark-table>

###### 空状态页面

<lark-table rows="3" cols="4" header-row="true" column-widths="200,200,200,200">

  <lark-tr>
    <lark-td>
      场景
    </lark-td>
    <lark-td>
      标题
    </lark-td>
    <lark-td>
      说明
    </lark-td>
    <lark-td>
      按钮
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      当前用户没有提交过项目
    </lark-td>
    <lark-td>
      你还没有提交项目
    </lark-td>
    <lark-td>
      提交项目后，可以在这里查看审核状态、项目数据和用户反馈。
    </lark-td>
    <lark-td>
      提交项目
      返回首页
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      筛选后没有结果
    </lark-td>
    <lark-td>
      没有符合条件的项目
    </lark-td>
    <lark-td>
      可以调整筛选条件后再查看
    </lark-td>
    <lark-td>
      清空筛选
    </lark-td>
  </lark-tr>
</lark-table>

### 3.6首页/项目列表页模块

#### 目标

- 让用户快速理解平台定位，建立对平台内容的第一印象。
- 让用户发现感兴趣的项目，并引导其进入项目详情页。
- 提供按兴趣筛选项目的能力，提升浏览效率。
- 为 Founder 提供明确的项目提交入口。
- 为黑客松活动相关项目提供独立曝光区域。

#### 涉及角色

<lark-table rows="5" cols="3" header-row="true" column-widths="200,200,411">

  <lark-tr>
    <lark-td>
      角色
    </lark-td>
    <lark-td>
      是否使用该模块
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      游客
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      可完整浏览首页内容；执行投票、关注、提交项目、进入Founder后台等操作时，触发登录弹窗。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td rowspan="2">
      登录用户
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      除浏览外，可直接完成投票、关注、分享等互动；可提交项目，并进入Founder后台。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      登录用户提交项目后即成为Founder，可通过首页入口进入Founder后台。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营管理员
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      通过独立运营后台进行项目管理，但首页推荐位的配置由运营后台控制（1.0先不做，后续完善）。
    </lark-td>
  </lark-tr>
</lark-table>

#### 页面展示规则

- 首页仅展示项目状态为 **已上线** 的项目。
- 以下状态的项目 **不展示** 在首页：
  - 草稿
  - 待审核
  - 需修改
  - 已拒绝
  - 已下架
- 点击任意项目卡片（不只是按钮），均跳转至对应项目的 **项目详情页**。

#### 页面结构

首页自上而下由以下区块组成：

1. 顶部导航
2. 首屏推荐区
3. 精选项目区
4. 项目筛选区
5. 全部项目列表

#### 各区域详细规则

##### 顶部导航

<text bgcolor="light-purple">展示内容</text>

- 左侧：平台名称
- 导航项：
  - 首页发现（tab1）
  - 关注（tab2）
  - 黑客松活动（tab3）
- 右侧操作区：
  - 用户未登录时：显示「登录」按钮、「Founder后台」按钮。
  - 用户已登录时：显示用户头像/昵称、「Founder后台」按钮。

<text bgcolor="light-purple">点击规则</text>

- 点击平台名称/点击「首页发现」：回到首页顶部。
- 点击「黑客松活动」：进入「黑客松活动」专区页面。
- 点击「登录」：打开登录弹窗。
- 点击「Founder后台」：
  - 未登录：打开登录弹窗。
  - 已登录且已提交过至少一个项目：进入Founder后台。
  - 已登录但未提交过任何项目：显示空状态，文案如下图。
    <image token="PFlvbYSB8obmjWxBNuScQ1MEnhe" width="556" height="460" align="left"/>

##### 首屏推荐区

<text bgcolor="light-purple">作用</text>

- 在首屏传达平台定位，并展示一个重点推荐项目，吸引用户进一步浏览。

<text bgcolor="light-purple">展示内容</text>

- 左侧文案区：
  - 主标题：**发现正在成长的新产品**
  - 副标题：浏览早期产品，投出人气票，提交真实反馈，也可以支持你看好的项目。
  - 主按钮：**浏览项目**（点击滚动至「全部项目列表」）
  - 次按钮：**提交项目**（点击规则同顶部导航“Founder后台”）
- 右侧推荐项目卡片：
  - 推荐项目来源：
    - 优先取运营后台手动设置的重点推荐项目。（1.0暂不支持运营配置）
    - 若未设置手动推荐，则自动取当前 **人气票数最高** 的已上线项目。
  - 卡片展示字段：
    - 项目封面
    - 项目名称
    - 一句话介绍
    - 项目阶段
    - 品类
    - 人气票数&按钮
    - 点赞量&按钮
    - 关注量（需要和点赞、投票、分享区分开，UI上能体现出是对用户的关注而不是对作品）
    - 分享按钮
    - 标签：可由运营撰写配置（1.0暂不支持）
    - “项目详情”按钮
  - 点击卡片/“项目详情”按钮：进入该项目详情页。

##### 精选项目区

<text bgcolor="light-purple">**作用**</text>

- 展示平台希望用户优先关注的优质项目，提供快速互动入口。

<text bgcolor="light-purple">**展示规则**</text>

- 固定展示 **4 个项目**。
- 项目来源优先级：
  1. 运营后台手动设置的精选项目。（1.0暂不支持）
  2. 若精选项目不足 4 个，由人气票数最高的已上线项目补足。

<text bgcolor="light-purple">**项目卡片展示字段**</text>

- 项目封面
- 项目名称
- 一句话介绍
- 项目阶段
- 品类
- Founder昵称
- 人气票数&按钮
- 点赞数&按钮
- 关注量（需要和点赞、投票、分享区分开，UI上能体现出是对用户的关注而不是对作品）
- 分享按钮
- “项目详情”按钮
- 标签：可由运营撰写配置（1.0暂不支持）

<text bgcolor="light-purple">**互动按钮及点击规则**</text>

- 点击卡片主体/“项目详情”按钮：进入项目详情页。
- ~~点击「投人气票」：~~
  - ~~未登录：打开登录弹窗。~~
  - ~~已登录：投票成功，人气票数 +1。~~
- 点击「关注」：
  - 未登录：打开登录弹窗。
  - 已登录：关注成功，关注数 +1。

##### 项目筛选区

<text bgcolor="light-purple">**作用**</text>

- 支持用户按多维度条件筛选项目，快速定位感兴趣的内容。

<text bgcolor="light-purple">**筛选项**</text>

<lark-table rows="8" cols="2" header-row="true" column-widths="200,653">

  <lark-tr>
    <lark-td>
      筛选项
    </lark-td>
    <lark-td>
      可选值
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目阶段
    </lark-td>
    <lark-td>
      全部、MVP阶段、成长阶段
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目品类
    </lark-td>
    <lark-td>
      全部<text color="red" bgcolor="light-yellow">、AI软件、效率工具、女性健康、开发者工具、生活方式、教育学习、其他</text>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      活动
    </lark-td>
    <lark-td>
      全部、当前正在进行的活动名称、历史活动名称
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      是否可内测
    </lark-td>
    <lark-td>
      全部、可内测
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      是否支持购买
    </lark-td>
    <lark-td>
      全部、支持购买
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      搜索
    </lark-td>
    <lark-td>
      搜索框 ：支持搜索关键词匹配项目名称/founder
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      排序
    </lark-td>
    <lark-td>
      最新上线、~~人气最高（点赞+票权重计算）~~、反馈最多、最近更新、点赞最多
    </lark-td>
  </lark-tr>
</lark-table>

<text bgcolor="light-purple">**筛选规则**</text>

- 用户选中任一筛选项后，项目列表立即刷新。
- 多个筛选条件之间为 **同时满足（AND）** 关系。
- 搜索关键词与筛选条件同时生效。
- 筛选后若无匹配项目，展示空状态。

##### 全部项目列表

<text bgcolor="light-purple">**展示规则**</text>

- 默认展示所有 **已上线** 项目。
- 首次进入页面默认排序为 <text color="red" bgcolor="light-yellow">XXXX</text>。
- 每行展示数量：XX个（<text color="red" bgcolor="light-yellow">UI定</text>）
- 下滑自动拉取更新

<text bgcolor="light-purple">**项目卡片字段**</text>

- 项目封面
- 项目名称
- 一句话介绍
- 项目阶段
- 品类
- Founder昵称
- 上线时间（审核通过的时间）
- 人气票数&按钮
- 点赞数&按钮
- 关注量（需要和点赞、投票、分享区分开，UI上能体现出是对用户的关注而不是对作品）
- 分享按钮
- 标签：可内测、支持购买、活动项目（若适用）

### 3.7黑客松活动专区模块

#### 目标

集中展示活动项目及人气榜单，为活动引流。

#### 展示条件

- 当前存在 **进行中** 的活动时，展示该区域。
- 若无进行中活动，但存在历史活动，可展示历史活动入口。
- 若没有任何活动，本区域 **隐藏**，不展示任何内容或空状态。

#### 展示内容

- 当前活动介绍
  - 活动名称
  - 活动说明
  - 活动时间
- 历史活动入口
- 本期活动参与的项目卡片展示：
  - 展示字段同首页的“全部项目列表”部分的展示逻辑
  - 点击榜单中的项目：进入该项目详情页。

### 3.8关注页面模块

#### 目标

便于用户关注喜爱的作品/Founder

#### 入口

网页导航栏tab2

#### 功能

展示用户点赞过/投过人气的作品，以及用户所关注的Founder的所有作品。

展示方式为卡片，展示逻辑同首页的“全部项目列表”部分

### 5.0运营后台&项目管理模块

#### 目标

运营后台用于让运营人员管理平台项目，并对项目展示及购买支持入口进行审核控制。

#### 涉及角色

<lark-table rows="3" cols="3" header-row="true" column-widths="114,135,504">

  <lark-tr>
    <lark-td>
      角色
    </lark-td>
    <lark-td>
      是否使用该模块
    </lark-td>
    <lark-td>
      说明
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      运营管理员
    </lark-td>
    <lark-td>
      是
    </lark-td>
    <lark-td>
      通过独立入口登录后台，执行项目审核、状态管理、查看审核记录等操作。
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      用户
    </lark-td>
    <lark-td>
      否
    </lark-td>
    <lark-td>
      感知不到运营后台的存在。
      Founder用户也无法访问运营后台，但可通过前台查看审核结果与修改要求。
    </lark-td>
  </lark-tr>
</lark-table>

#### 运营后台入口

运营后台有对应访问地址，运营人员访问该地址后进入后台登录页。

#### 运营后台功能

##### 运营后台登录页

- 页面字段：
  - 账号输入框，占位文案：`请输入账号`
  - 密码输入框，占位文案：`请输入密码`
  - 登录按钮，文案：`登录`
- 登录规则：
  - 账号或密码为空时，点击登录提示：`请输入账号和密码`
  - 账号或密码错误时，提示：`账号或密码错误`
  - 登录成功后进入后台首页
- 运营账号：
  - 1.0 版本运营账号采用系统写死方式，暂不提供注册、找回密码等能力。
  - 测试账号暂定：

账号：`admin`

密码：`admin123`

上线前需替换为正式账号体系。

##### 运营后台首页

- 页面要素
  - 头像（系统默认的）
  - 退出登录按钮文案：`退出登录`
  - 菜单栏
    - 项目管理
    - 项目审核（进入运营后台首页默认定位到项目管理页面）
    - 审核记录（1.0可简单做列表）
    - 项目统计

###### 项目管理模块

<image token="AURqbuvuqofScgxMrlZc1m48n3f" width="1024" height="1024" align="center"/>

**注意**，在上图基础上还需要补充按照浏览量、点赞量、投人气、评论量正序倒叙排序的功能点；以及无论展开/收缩状态，卡片均需展示浏览量、点赞量、投票量、转发量、评论量的数值（无则显示为0）。

<grid cols="2">

  <column width="42">
    <image token="CVIVbRh5MoqaqexONincRF5dnRd" width="430" height="336" align="left"/>

  </column>
  <column width="57">
    <image token="OIlCb71cLoV1yNxxrxZcU5O3nFI" width="558" height="322" align="center"/>

  </column>

</grid>

- 页面顶部标题：`项目管理`
- 功能区域：
  - 项目搜索：可以搜索项目名称或者Founder名称
  - 项目卡片的展示方式：支持“收缩浏览”或“卡片展开”
  - 项目阶段筛选：全部、MVP阶段、成长阶段
  - 项目状态筛选：全部、待审核、需修改、已上线、已下架、已拒绝
  - 项目品类筛选：全部、女性健康……（根据实际的品类分类）
  - 活动筛选：全部、无、活动1、活动n
  - 购买支持：全部、已申请、未申请
  - **支持按照：浏览量、分享量、点赞量、投票数、评论量进行正序/倒序排序**
  - 项目列表的卡片字段：
    - 收缩浏览状态展示字段：项目名称、Founder、项目阶段（MVP阶段/成长阶段）、项目状态、所属活动（无则不显示）、是否申请购买支持、提交时间、<text underline="true">浏览量、分享量、点赞量、投票数、评论量</text>、**操作按钮、**
    - 卡片展开状态展示字段：
      - 项目基础信息：项目名称、一句话介绍、项目品类、项目阶段、所属活动
      - 展示资料：项目封面、Demo 图片、Demo 视频、Demo 链接
      - 项目说明：项目介绍、目标用户、用户问题、当前进展、下一步计划
      - 用户参与设置：是否开放内测、内测名额、内测说明、<text color="red" bgcolor="light-yellow">是否允许用户评论</text>
      - 购买/支持申请信息：是否申请购买支持入口、交付说明、预计交付时间、售后说明、退款说明
      - Founder 联系信息：联系人姓名、手机号、邮箱、微信号、团队名称
      - 审核记录：展示历史审核动作、审核时间、审核人和审核说明
      - <text underline="true">浏览量、分享量、点赞量、投票数、评论量</text>
      - **操作按钮**
  - 操作按钮逻辑：若为“收缩浏览”状态，仅显示“`查看详情`”按钮，点击后随即展开该卡片。展开后的卡片按照项目状态，展示如下按钮。
    - 待审核项目：显示按钮： `审核通过`、`要求修改`、`拒绝上线`，以及一个文本输入框，运营可填写拒绝理由
    - 需修改项目：无
    - 已上线项目：显示 `下架项目`，以及一个文本输入框，运营可填写拒绝理由
    - 已下架项目：显示`恢复上线`
    - 已拒绝项目：无

###### 项目审核模块

- 页面顶部标题：`项目审核`
- 审核是运营后台最重要和核心的能力，实际在“项目管理”tab中已经包含了审核的所有功能，但“项目审核”tab是为了便于运营集中在审核这一目标上。
  - 该页面=“卡片展开”模式下，筛选“待审核”状态下的“项目管理”页面。但项目审核tab下不展示其他，只展示展开的卡片！
  - 且，运营操作完后，已处理的卡片消失。

###### 审核记录模块

<image token="HuBhbdUjUovI7QxhiEDcsHcwnoe" width="1364" height="1474" align="left"/>

- 页面顶部标题：`审核记录`
- 列表字段

<lark-table rows="13" cols="6" header-row="true" column-widths="200,200,200,200,200,64">

  <lark-tr>
    <lark-td>
      字段名称
    </lark-td>
    <lark-td>
      字段名
    </lark-td>
    <lark-td>
      字段说明
    </lark-td>
    <lark-td>
      枚举值
    </lark-td>
    <lark-td>
      示例
    </lark-td>
    <lark-td>
      优先级
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      记录ID
    </lark-td>
    <lark-td>
      audit_record_id
    </lark-td>
    <lark-td>
      每条审核记录的唯一编号
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目ID
    </lark-td>
    <lark-td>
      project_id
    </lark-td>
    <lark-td>
      对应被审核的项目
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      项目名称
    </lark-td>
    <lark-td>
      project_name
    </lark-td>
    <lark-td>
      展示给运营看的项目名称
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      雌激素趋势日记
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      Founder用户ID
    </lark-td>
    <lark-td>
      user_id
    </lark-td>
    <lark-td>
      项目提交人的用户ID
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      Founder名称
    </lark-td>
    <lark-td>
      founder_name
    </lark-td>
    <lark-td>
      项目提交人的展示名称
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      Nina
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核类型
    </lark-td>
    <lark-td>
      audit_type
    </lark-td>
    <lark-td>
      这次审核处理的是哪类事项
    </lark-td>
    <lark-td>
      项目上线审核
      项目状态处理
      资料修改审核
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      P5
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核动作
    </lark-td>
    <lark-td>
      audit_action
    </lark-td>
    <lark-td>
      运营本次具体做了什么
    </lark-td>
    <lark-td>
      审核通过
      要求修改
      拒绝上线
      恢复上线
      下架项目
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核前项目状态
    </lark-td>
    <lark-td>
      before_project_status
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      待审核
      需修改
      已上线
      已下架
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      P5
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核后项目状态
    </lark-td>
    <lark-td>
      after_project_status
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      需修改
      已上线
      已下架
      已拒绝
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核原因
    </lark-td>
    <lark-td>
      audit_reason
    </lark-td>
    <lark-td>
      运营填写的原因
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      购买说明不清晰，请补充交付方式和售后说明
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核人
    </lark-td>
    <lark-td>
      operator_name
    </lark-td>
    <lark-td>
      执行审核操作的运营账号
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      admin
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>
      审核时间
    </lark-td>
    <lark-td>
      audit_time
    </lark-td>
    <lark-td>
      操作发生的时间
    </lark-td>
    <lark-td>
      -
    </lark-td>
    <lark-td>
      2026-06-28 14:35:20
    </lark-td>
    <lark-td>
    </lark-td>
  </lark-tr>
</lark-table>

###### 项目统计模块

