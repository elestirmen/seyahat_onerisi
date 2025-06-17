# seyahat_onerisi

Bu depoda Ürgüp ilçesindeki bazı ilgi noktaları (POI) arasında alternatif rotalar oluşturan örnek bir Python betiği bulunmaktadır.

## Kurulum

Gerekli bağımlılıkları kurmak için:

```bash
pip install -r requirements.txt
```

## Kullanım

```bash
python create_urgup_routes.py
```

Betik çalıştıktan sonra aynı klasörde `urgup_rotalar.html` adında bir dosya oluşur. Bu dosyayı bir tarayıcıda açarak POI noktalarını ve alternatif rotaları görebilirsiniz.

### Yol ağı kullanımı

Gerçek yol verisi kullanmak isterseniz `osmnx` kütüphanesi ile Ürgüp'ün yol ağını indirip `urgup_driving.graphml` olarak kaydedebilirsiniz:

```python
import osmnx as ox
G = ox.graph_from_place("Ürgüp, Türkiye", network_type="drive")
ox.save_graphml(G, "urgup_driving.graphml")
```

Dosya mevcut değilse betik örnek koordinatlarla yaklaşık rotalar çizer.

> **Not:** Bazı ortamlarda OpenStreetMap servislerine erişim kısıtlanmış olabilir. Böyle bir durumda betik otomatik indirme yapamaz ve hazır rotaları kullanır.

