export default {
  pages: [
    'pages/index/index',
    'pages/audio/index',
    'pages/pigeon/index',
    'pages/test/index',
    'pages/shop/index',
    'pages/profile/index',
    'pages/personality/index',
  ],
  window: {
    navigationBarTitleText: '琉璃文创园区',
    navigationBarBackgroundColor: '#667eea',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f5f5',
  },
  permission: {
    'scope.userLocation': {
      desc: '为了提供园区导航服务，需要获取您的位置信息',
    },
    'scope.userInfo': {
      desc: '为了提供个性化服务，需要获取您的微信头像和昵称',
    },
  },
  requiredBackgroundModes: ['location'],
}
