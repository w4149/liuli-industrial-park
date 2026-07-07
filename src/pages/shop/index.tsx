import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { ShopItem } from '@/types'
import { useUserStore } from '@/store/useUserStore'
import { api } from '@/services/api'
import './index.scss'

const mockShopItems: ShopItem[] = [
  {
    id: 'item-001',
    name: '琉璃脊兽挂件',
    description: '精美琉璃材质的脊兽挂件，小巧玲珑，寓意吉祥',
    price: 50,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=glazed%20ridge%20beast%20pendant%20charm%20jewelry%20elegant&image_size=square',
    stock: 100,
  },
  {
    id: 'item-002',
    name: '琉璃文创笔记本',
    description: '封面镶嵌琉璃装饰，记录你的创意灵感',
    price: 30,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=elegant%20notebook%20with%20glass%20decorative%20cover%20stationery&image_size=square',
    stock: 50,
  },
  {
    id: 'item-003',
    name: '琉璃艺术明信片',
    description: '精选园区琉璃艺术品照片，传递美好祝福',
    price: 15,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=glass%20art%20postcard%20collection%20beautiful%20lithography&image_size=square',
    stock: 200,
  },
  {
    id: 'item-004',
    name: '琉璃手工体验券',
    description: '体验亲手制作琉璃艺术品的乐趣',
    price: 100,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=glass%20art%20workshop%20experience%20ticket%20creative&image_size=square',
    stock: 30,
  },
]

const Shop: React.FC = () => {
  const { user, shopItems, setShopItems, updateInspirationValue } = useUserStore()
  const [items, setItems] = useState<ShopItem[]>([])
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadItems = async () => {
      try {
        const fetchedItems = await api.shop.getAllItems()
        if (fetchedItems.length > 0) {
          setItems(fetchedItems)
          setShopItems(fetchedItems)
        } else {
          setItems(mockShopItems)
          setShopItems(mockShopItems)
        }
      } catch {
        setItems(mockShopItems)
        setShopItems(mockShopItems)
      }
    }

    loadItems()
  }, [])

  const handleBuy = (item: ShopItem) => {
    if (!user || user.inspiration_value < item.price) {
      setError('灵感值不足')
      setTimeout(() => setError(''), 2000)
      return
    }
    setSelectedItem(item)
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    if (!selectedItem || !user) return

    try {
      await api.shop.purchaseItem(user.id, selectedItem.id)
      updateInspirationValue(user.inspiration_value - selectedItem.price)
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, stock: item.stock - 1 } : item
        )
      )
      setError('兑换成功！')
    } catch (err) {
      setError(err instanceof Error ? err.message : '兑换失败')
    } finally {
      setShowConfirm(false)
      setSelectedItem(null)
      setTimeout(() => setError(''), 2000)
    }
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="shop-page">
      <View className="header">
        <Text className="back-btn" onClick={handleBack}>←</Text>
        <Text className="title">灵感商店</Text>
        <View className="inspiration-badge">
          <Text className="badge-icon">✨</Text>
          <Text className="badge-value">{user?.inspiration_value || 0}</Text>
        </View>
      </View>

      {error && <Text className="error-message">{error}</Text>}

      <View className="items-list">
        {items.map((item) => (
          <View key={item.id} className="item-card">
            <Image className="item-image" src={item.image} mode="aspectFill" />
            <View className="item-info">
              <Text className="item-name">{item.name}</Text>
              <Text className="item-description">{item.description}</Text>
              <View className="item-footer">
                <View className="price-tag">
                  <Text className="price-icon">✨</Text>
                  <Text className="price-value">{item.price}</Text>
                </View>
                <Text className="stock-info">库存: {item.stock}</Text>
              </View>
              <button
                className={`buy-btn ${user && user.inspiration_value >= item.price && item.stock > 0 ? '' : 'disabled'}`}
                onClick={() => handleBuy(item)}
                disabled={!user || user.inspiration_value < item.price || item.stock <= 0}
              >
                兑换
              </button>
            </View>
          </View>
        ))}
      </View>

      {showConfirm && selectedItem && (
        <View className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">确认兑换</Text>
            <Text className="confirm-message">
              确定使用 {selectedItem.price} 灵感值兑换「{selectedItem.name}」吗？
            </Text>
            <View className="confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowConfirm(false)}>
                取消
              </button>
              <button className="confirm-btn" onClick={handleConfirm}>
                确认兑换
              </button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default Shop