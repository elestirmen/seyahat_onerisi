# -*- coding: utf-8 -*-
"""
POI Verilerini Veritabanına Import Etme Scripti
"""

import os
import sys
from poi_database_adapter import POIDatabaseFactory
import json

# Verdiğiniz POI verileri - TÜM VERİLER
POI_DATA = {
    "Hodul Dağı Tümülüsü (Ağcaören Köyü)": (38.5162, 35.0436),
    "Yeni Cami (Ağcaören Köyü)": (38.5429, 35.0271),
    "Eski Cami (Ağcaören Köyü)": (38.5426, 35.0273),
    "Çeşme (Ağcaören Köyü)": (38.5427, 35.0224),
    "Mezarlık 1 (Ağcaören Köyü)": (38.5416, 35.0260),
    "Mezarlık 2 (Ağcaören Köyü)": (38.5428, 35.0245),
    "Mezarlık 3 (Ağcaören Köyü)": (38.5415, 35.0269),
    "Çeşme 1 (Akköy Köyü)": (38.5867, 35.0522),
    "Çeşme 2 (Akköy Köyü)": (38.5862, 35.0517),
    "Çeşme 3 (Akköy Köyü)": (38.5876, 35.0504),
    "Çeşme 4 (Akköy Köyü)": (38.5884, 35.0493),
    "Çeşme 5 (Akköy Köyü)": (38.5886, 35.0471),
    "Akköy Hacı Mikdat Cami": (38.5871, 35.0514),
    "Kaya Cami (Akköy Köyü)": (38.5867, 35.0525),
    "Akköy Hat Cami": (38.5864, 35.0526),
    "Saray (Akköy Köyü)": (38.5864, 35.0526),
    "Kilise I (Akköy Köyü)": (38.5876, 35.0513),
    "Kilise II (Akköy Köyü)": (38.5819, 35.0617),
    "Yusuf Bey Cami (Ayvalı Köyü)": (38.5462, 34.8695),
    "Köprü (Ayvalı Köyü)": (38.5455, 34.8708),
    "Kilise (Ayvalı Köyü)": (38.5462, 34.8706),
    "Mezarlık (Ayvalı Köyü)": (38.5426, 34.8689),
    "Ayvalı Nekropol": (38.5480, 34.8630),
    "Çeşme (Bahçeli Köyü)": (38.5483, 34.8505),
    "Bahçeli Köyü Mustafa Ağa Cami": (38.5481, 34.8494),
    "Bahçeli Köyü Osman Ağa Cami": (38.5481, 34.8507),
    "Okul (Bahçeli Köyü)": (38.5484, 34.8483),
    "İçeri Dere Kilisesi (Bahçeli Köyü)": (38.5500, 34.8519),
    "Kilise II (Bahçeli Köyü)": (38.5558, 34.8513),
    "Kilise III (Bahçeli Köyü)": (38.5558, 34.8513),
    "Değirmen (Bahçeli Köyü)": (38.5491, 34.8475),
    "Kilise (Başdere Köyü Eyüplü Mah.)": (38.5617, 35.0683),
    "Kagir Cami (Yeni) (Başdere Köyü)": (38.5575, 35.0728),
    "Kagir Cami (Başdere Köyü)": (38.5583, 35.0718),
    "Kaya Cami+Kagir (Başdere Köyü)": (38.5543, 35.0729),
    "Çeşme I (Başdere Köyü)": (38.5579, 35.0716),
    "Okul (Başdere Köyü)": (38.5579, 35.0728),
    "Başdere Köyü Çeşme II": (38.5596, 35.0701),
    "Değirmen I (Başdere Köyü)": (38.5641, 35.0654),
    "Değirmen II (Başdere Köyü)": (38.5551, 35.0714),
    "Mezarlık (Başdere Köyü)": (38.5546, 35.0734),
    "Yeni Cami (Başdere Köyü)": (38.5521, 35.0762),
    "Büyük Çeç Tümülüsü (Başdere Köyü)": (38.4888, 35.0866),
    "Küçük Çeç Tümülüsü (Başdere Köyü)": (38.4817, 35.0817),
    "Boyalı Köyü Camisi": (38.5924, 35.0085),
    "Çeşme I (Boyalı Köyü)": (38.5928, 35.0085),
    "Çeşme II (Boyalı Köyü)": (38.5914, 35.0062),
    "İlkokul (Boyalı Köyü)": (38.5921, 35.0069),
    "Kilise (Boyalı Köyü)": (38.5919, 35.0082),
    "Sağlık Ocağı (Boyalı Köyü)": (38.5920, 35.0075),
    "Mezarlık (Boyalı Köyü)": (38.5920, 35.0047),
    "Necippaşa Cami (Cemil Köyü)": (38.5229, 34.9334),
    "Cami (Minare) (Cemil Köyü)": (38.5229, 34.9320),
    "Hagios Stefanos Kilisesi- Keşlik Manastırı (Cemil Köyü)": (38.5142, 34.9431),
    "Archangelios Kilisesi ve Keşlik Manastırı (Cemil Köyü)": (38.5150, 34.9432),
    "Kutsal Haç Kilisesi (Cemil Köyü)": (38.5224, 34.9343),
    "Meryem Ana Kilisesi Mezarlık Alanı (Cemil Köyü)": (38.5285, 34.9349),
    "Eski Rum Okulu (Konut) (Cemil Köyü)": (38.5224, 34.9334),
    "İlkokul (Cemil Köyü)": (38.5215, 34.9331),
    "Şapel (Cemil Köyü)": (38.5224, 34.9334),
    "Kütüphane (Cemil Köyü)": (38.5229, 34.9335),
    "Çeşme 1 (Cemil Köyü)": (38.5230, 34.9318),
    "Çeşme 2 ve Çamaşırhane (Cemil Köyü)": (38.5215, 34.9323),
    "Çeşme 3 (Cemil Köyü)": (38.5222, 34.9332),
    "Çeşme 4 (Cemil Köyü)": (38.5225, 34.9350),
    "Çeşme 5 (Mustafa Ağa Çeşmesi) (Cemil Köyü)": (38.5223, 34.9350),
    "Köprü (Yıkıldı) (Cemil Köyü)": (38.5224, 34.9334),
    "Köprü (Cemil Köyü)": (38.5215, 34.9323),
    "Köy Odası (Cemil Köyü)": (38.5230, 34.9332),
    "Cemilköy İgnimbiritleri": (38.5199, 34.9337),
    "Cemilköy Tümülüsü": (38.5229, 34.9387),
    "Damsa Vadisi ve Cemil Peribacaları": (38.5146, 34.9438),
    "Çökek Köyü İlkokul": (38.6847, 34.9551),
    "Cami (Çökek Köyü)": (38.6844, 34.9464),
    "Köy İçi Kilise (Çökek Köyü)": (38.6851, 34.9460),
    "Manastır (Çökek Köyü)": (38.6799, 34.9532),
    "Köy Konağı (Çökek Köyü)": (38.6835, 34.9450),
    "Emir Fahreddin Saray Sâlâriye (Sarıhan) Hanı (Çökek Köyü)": (38.7115, 34.9102),
    "Kaya Cami (Demirtaş Köyü)": (38.5736, 35.0575),
    "Türbe- Mezarlık (Demirtaş Köyü)": (38.5733, 35.0572),
    "Değirmen (Demirtaş Köyü)": (38.5729, 35.0571),
    "Mezarlık Alanı (Karakaya Mevkii) (İbrahimpaşa Köyü)": (38.5991, 34.8463),
    "İbrahimpaşa Nekropol": (38.5827, 34.8684),
    "Manay Tepesi (İbrahimpaşa Köyü)": (38.5921, 34.8514),
    "Babayan Kilisesi (İbrahimpaşa Köyü)": (38.6007, 34.8512),
    "Örsürtü Cami (İbrahimpaşa Köyü)": (38.6011, 34.8504),
    "Hacı Mehmet Cami (İbrahimpaşa Köyü)": (38.6003, 34.8498),
    "1 Numaralı Çeşme (İbrahimpaşa Köyü)": (38.6013, 34.8504),
    "2 Numaralı Çeşme (İbrahimpaşa Köyü)": (38.6005, 34.8494),
    "İbrahimpaşa Köprüsü": (38.5991, 34.8499),
    "Cami (İltaş Köyü)": (38.5817, 35.0395),
    "Çeşme (İltaş Köyü)": (38.5817, 35.0395),
    "Okul (İltaş Köyü)": (38.5822, 35.0396),
    "1 Numaralı Kilise (İltaş Köyü)": (38.5745, 35.0396),
    "2 Numaralı Kilise (İltaş Köyü)": (38.5745, 35.0396),
    "Mezarlık alanı ve Türbe (Karacaören Köyü)": (38.6110, 34.9792),
    "Cami (Karacaören Köyü)": (38.6150, 34.9768),
    "Okul (Karacaören Köyü)": (38.6146, 34.9768),
    "Eski Han (Karacaören Köyü)": (38.6145, 34.9763),
    "Muhtarlık Binası (Karacaören Köyü)": (38.6142, 34.9766),
    "1 Numaralı Çeşme ve Çamaşırhane (Karacaören Köyü)": (38.6167, 34.9757),
    "2 Numaralı Çeşme (Karacaören Köyü)": (38.6142, 34.9774),
    "Güvercinlikler (Karacaören Köyü)": (38.6161, 34.9812),
    "Kurt Deresi Kaya Mezarı (Karacaören Köyü)": (38.6045, 34.9725),
    "Kurt Deresi Kilise (Karacaören Köyü)": (38.6045, 34.9725),
    "Hacı İsa Cami (Karain Köyü)": (38.5866, 34.9932),
    "Çeşme (Karain Köyü)": (38.5901, 34.9911),
    "Namazgah (Karain Köyü)": (38.5872, 34.9925),
    "Sultan Alaaddin Cami (Yıkıldı) (Karain Köyü)": (38.5916, 34.9910),
    "Okul (Karain Köyü)": (38.5893, 34.9911),
    "Bezirhane (Karain Köyü)": (38.5910, 34.9912),
    "Kilise-Manastır (Karain Köyü)": (38.5968, 34.9901),
    "Değirmen (Karain Köyü)": (38.5908, 34.9911),
    "Köy Konağı- Muhtarlık (Karain Köyü)": (38.5880, 34.9916),
    "Mezarlık (Karain Köyü)": (38.5886, 34.9923),
    "Güvercinlik (Karain Köyü)": (38.5874, 34.9909),
    "Sağlık Ocağı- Lojman (Karain Köyü)": (38.5875, 34.9929),
    "Kütüphane (Karain Köyü)": (38.5875, 34.9923),
    "Türbe ve Mezarlık (Karakaya Köyü)": (38.7135, 35.0327),
    "Kaya cami (Karakaya Köyü)": (38.7198, 35.0292),
    "Sultan Alaaddin Cami (Yıkıldı) (Karlık Köyü)": (38.5596, 34.9862),
    "Köy Konağı- Müştemilat (Karlık Köyü)": (38.5598, 34.9869),
    "Eski İptidai Mektebi (Karlık Köyü)": (38.5592, 34.9853),
    "Karlık İlkokulu": (38.5580, 34.9844),
    "Çeşme (Karlık Köyü)": (38.5582, 34.9841),
    "Okul Lojman- Bahçesi (Karlık Köyü)": (38.5576, 34.9842),
    "Mezarlık (Karlık Köyü)": (38.5585, 34.9868),
    "Değirmen (Karlık Köyü)": (38.5591, 34.9873),
    "Karlık Kilisesi": (38.5697, 34.9909),
    "Karlık Köyü Kurt Deresi Nekropol": (38.5697, 34.9909),
    "Mazı Nekropol Alanı": (38.4714, 34.8382),
    "Mazıköy Kilisesi": (38.4669, 34.8373),
    "Mazı Yer Altı Şehri": (38.4702, 34.8390),
    "Mazıköy İlkokulu": (38.4689, 34.8398),
    "Mazı Muhtarlık Binası": (38.4696, 34.8394),
    "Mazıköy Camisi": (38.4695, 34.8396),
    "Sağlık Ocağı (Mazı Köyü)": (38.4706, 34.8404),
    "Baş Değirmen (Mustafapaşa Köyü)": (38.5667, 34.9192),
    "Kukuşdibi Tepesi (Mustafapaşa Köyü)": (38.5883, 34.9090),
    "Gorgoli Tepesi/ Meryem Ana Dağı (Mustafapaşa Köyü)": (38.5337, 34.9015),
    "Kalaşa Mevkii (Mustafapaşa Köyü)": (38.5801, 34.8809),
    "Topakoğlu Bezirhanesi (Mustafapaşa Köyü)": (38.5831, 34.8975),
    "İsimsiz Bezirhane (Mustafapaşa Köyü)": (38.5823, 34.8980),
    "Karadağ Tümülüsü (Sarıhıdır Köyü)": (38.7561, 34.9697),
    "Hanözü Peribacaları (Sarıhıdır Köyü)": (38.7244, 34.8963),
    "Sarıhıdır Tüneli": (38.7414, 34.9366),
    "Değirmen I (Sarıhıdır Köyü)": (38.7244, 34.8963),
    "Değirmen II (Sarıhıdır Köyü)": (38.7280, 34.9062),
    "Sarıhıdır Köyü Eski Cami": (38.7343, 34.9318),
    "Mezarlık Alanı (Sarıhıdır Köyü)": (38.7318, 34.9228),
    "Sofu Dede Türbesi (Sofular Köyü)": (38.7148, 34.9901),
    "Sofular Kilisesi": (38.7137, 34.9892),
    "Sofular Nekropol": (38.7137, 34.9892),
    "Sofular Höyük": (38.7213, 35.0087),
    "Sofular İlkokulu": (38.7115, 34.9916),
    "Sofular Köyü Camisi": (38.7113, 34.9921),
    "Sofular Köyü Kaya Camisi": (38.7115, 34.9930),
    "Mezarlık alanı (Şahinefendi Köyü)": (38.4695, 34.9500),
    "Şahinefendi Köyü Camii": (38.4693, 34.9479),
    "1 Nolu Çeşme (Şahinefendi Köyü)": (38.4674, 34.9443),
    "2 Nolu Çeşme (Şahinefendi Köyü)": (38.4692, 34.9485),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (1)": (38.4765, 34.9552),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (2)": (38.4731, 34.9537),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (3)": (38.4712, 34.9572),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (4)": (38.4709, 34.9556),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (5)": (38.4709, 34.9554),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (6)": (38.4704, 34.9547),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (7)": (38.4711, 34.9549),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (8)": (38.4712, 34.9542),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (9)": (38.4714, 34.9535),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (10)": (38.4717, 34.9539),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (11)": (38.4717, 34.9538),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (12)": (38.4721, 34.9540),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (13)": (38.4715, 34.9534),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (14)": (38.4719, 34.9535),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (15)": (38.4713, 34.9529),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (16)": (38.4723, 34.9524),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (17)": (38.4735, 34.9517),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (18)": (38.4745, 34.9510),
    "Şahinefendi Köyü Kilise-Manastır Bölgesi (19)": (38.4719, 34.9557),
    "Sobesos Antik Kenti (Şahinefendi Köyü)": (38.4647, 34.9655),
    "Şahinefendi Köyü İlkokulu": (38.4694, 34.9485),
    "Şahinefendi Orta Tepe": (38.4765, 34.9552),
    "Şahinefendi Köyü Kral yolu": (38.4765, 34.9552),
    "Şahinefendi Köyü Bezirhane": (38.4692, 34.9472),
    "Şekilli Roma Mezarları (Taşkınpaşa Köyü)": (38.4734, 34.9635),
    "Çeşme (Taşkınpaşa Köyü)": (38.4940, 34.9480),
    "Taşkınpaşa Cami": (38.4922, 34.9471),
    "Taşkınpaşa Medresesi/Zaviye": (38.4929, 34.9475),
    "Taşkınpaşa Namazgah": (38.4928, 34.9499),
    "Taşkınpaşa Fosil Yatağı": (38.5017, 34.9308),
    "Taşkınpaşa Peribacası": (38.5051, 34.9330),
    "Kesikbaş Türbesi (Taşkınpaşa Köyü)": (38.4929, 34.9504),
    "Taşkınpaşa İlkokulu": (38.4923, 34.9469),
    "Kale Tepe (Taşkınpaşa Köyü)": (38.4930, 34.9455),
    "Sağlık Ocağı (Taşkınpaşa Köyü)": (38.4943, 34.9489),
    "Taşkınpaşa İçeribağ Kilisesi": (38.4911, 34.9446),
    "Köy İçi İsimsiz Kilise (Taşkınpaşa Köyü)": (38.4934, 34.9468),
    "Kütüphane (Taşkınpaşa Köyü)": (38.4940, 34.9479),
    "1 Numaralı Su Değirmeni (Taşkınpaşa Köyü)": (38.5022, 34.9511),
    "2 Numaralı Su Değirmeni (Taşkınpaşa Köyü)": (38.4911, 34.9529),
    "Köy İçi Kagir Değirmen (Taşkınpaşa Köyü)": (38.4953, 34.9494),
    "Eski Mescit (Taşkınpaşa Köyü)": (38.4943, 34.9476),
    "Çamaşırhane (Taşkınpaşa Köyü)": (38.4915, 34.9466),
    "Yazılıkaya (Taşkınpaşa Köyü)": (38.4837, 34.9457),
    "Taşkınpaşa Köyü Kral yolu (1)": (38.5105, 34.9511),
    "Taşkınpaşa Köyü Kral yolu (2)": (38.4800, 34.9870),
    "Ulaşlı Köyü Camisi": (38.6673, 34.9520),
    "Mezarlık Alanı (Ulaşlı Köyü)": (38.6677, 34.9528),
    "Güvercinlikler (Ulaşlı Köyü)": (38.6758, 34.9655),
    "Çeşme/ Çamaşırhane 1 (Yeşilöz Köyü)": (38.5419, 34.9912),
    "Çeşme/ Çamaşırhane 2 (Yeşilöz Köyü)": (38.5414, 34.9912),
    "Çeşme/ Çamaşırhane 3 (Yeşilöz Köyü)": (38.5402, 34.9940),
    "Çeşme 4 (Yeşilöz Köyü)": (38.5367, 35.0078),
    "Yeşilöz Köyü Necippaşa Cami": (38.5407, 34.9922),
    "Yeşilöz Köyü Kaya Cami": (38.5422, 34.9906),
    "Çağlak Mevkii (Yeşilöz Köyü)": (38.5372, 34.9953),
    "Alkaya Harabeleri (1) (Yeşilöz Köyü)": (38.5369, 34.9908),
    "Alkaya Harabeleri (2) (Yeşilöz Köyü)": (38.5363, 34.9891),
    "Alkaya Harabeleri (3) (Yeşilöz Köyü)": (38.5334, 34.9846),
    "Alkaya Harabeleri (4) (Yeşilöz Köyü)": (38.5116, 34.9798),
    "Yeşilöz Köyü Roma Mezarları (1)": (38.5334, 34.9846),
    "Yeşilöz Köyü Roma Mezarları (2)": (38.5374, 34.9880),
    "Yeşilöz Köyü Yazıtlı Roma Mezarı": (38.5375, 34.9860),
    "Yeşilöz Köyü Roma Yolu (1)": (38.5369, 34.9908),
    "Yeşilöz Köyü Roma Yolu (2)": (38.5363, 34.9891),
    "Ağmaz Harabeleri (1) (Yeşilöz Köyü)": (38.5116, 34.9798),
    "Ağmaz Harabeleri (2) (Yeşilöz Köyü)": (38.5105, 34.9842),
    "Yeşilöz Köyü Lahit": (38.5303, 34.9973),
    "Yeşilöz Köyü Ören Mevkii": (38.5024, 35.0388),
    "Yeşilöz Saint Theodore Kilisesi": (38.5475, 34.9902),
    "Yeşilöz Köy İçi İsimsiz Kilise (1)": (38.5399, 34.9911),
    "Yeşilöz Köy İçi İsimsiz Kilise (2)": (38.5399, 34.9911),
    "Yeşilöz Köy İçi İsimsiz Kilise (3)": (38.5400, 34.9912),
    "Sultan Aleaddin Cami (Mescit) (Yeşilöz Köyü)": (38.5396, 34.9934),
    "Tarihi Mezarlık Alanı (Yeşilöz Köyü)": (38.5375, 34.9972),
    "1 Numaralı Motorlu Değirmen (Yeşilöz Köyü)": (38.5417, 34.9928),
    "2 Numaralı Motorlu Değirmen (Yeşilöz Köyü)": (38.5422, 34.9936),
    "Seten (Yeşilöz Köyü)": (38.5424, 34.9938),
    "1 Numaralı Su Değirmeni (Yeşilöz Köyü)": (38.5439, 34.9938),
    "2 Numaralı Su Değirmeni (Yeşilöz Köyü)": (38.5469, 34.9952),
    "Eski İlkokul/Köy Konağı (Yeşilöz Köyü)": (38.5410, 34.9920),
    "Hodul Dağı Tümülüsü (Yeşilöz Köyü)": (38.5024, 35.0388)
}

def categorize_poi(name):
    """POI adına göre kategori belirle"""
    name_lower = name.lower()
    
    if any(word in name_lower for word in ['cami', 'kilise', 'türbe', 'manastır', 'mescit']):
        return 'dini'
    elif any(word in name_lower for word in ['tümülüs', 'nekropol', 'antik', 'roma', 'bizans', 'harabe']):
        return 'tarihi'
    elif any(word in name_lower for word in ['çeşme', 'köprü', 'değirmen', 'çamaşırhane']):
        return 'mimari'
    elif any(word in name_lower for word in ['okul', 'müze', 'kütüphane']):
        return 'kulturel'
    elif any(word in name_lower for word in ['mezarlık']):
        return 'mezarlik'
    elif any(word in name_lower for word in ['saray', 'han', 'kale']):
        return 'saray_kale'
    else:
        return 'diger'

def get_description(name, category):
    """POI için açıklama oluştur"""
    descriptions = {
        'dini': f"{name} - Bölgenin önemli dini yapılarından biri.",
        'tarihi': f"{name} - Tarihi ve arkeolojik değere sahip antik yapı.",
        'mimari': f"{name} - Geleneksel Anadolu mimarisinin örneği.",
        'kulturel': f"{name} - Yerel kültür ve eğitim hayatının merkezi.",
        'mezarlik': f"{name} - Tarihi mezarlık alanı.",
        'saray_kale': f"{name} - Tarihi savunma ve yönetim yapısı.",
        'diger': f"{name} - Bölgenin önemli noktalarından biri."
    }
    return descriptions.get(category, f"{name} - İlgi çekici nokta.")

def import_pois():
    """POI verilerini veritabanına import et"""
    try:
        # Veritabanı bağlantısı
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        
        print(f"🔗 Veritabanına bağlanılıyor: {db_type}")
        
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        db.connect()
        
        print("✅ Veritabanı bağlantısı başarılı")
        
        # POI'leri ekle
        added_count = 0
        skipped_count = 0
        
        for poi_name, (lat, lon) in POI_DATA.items():
            try:
                # Kategori belirle
                category = categorize_poi(poi_name)
                
                # Açıklama oluştur
                description = get_description(poi_name, category)
                
                # POI'yi ekle
                poi_data = {
                    'name': poi_name,
                    'category': category,
                    'latitude': lat,
                    'longitude': lon,
                    'description': description,
                    'attributes': {
                        'source': 'manual_import',
                        'import_date': '2025-02-08',
                        'verified': False
                    }
                }
                
                # Mevcut POI kontrolü (basit isim kontrolü)
                # Aynı isimde POI var mı kontrol et
                try:
                    with db.conn.cursor() as cur:
                        cur.execute("SELECT id FROM pois WHERE name = %s", (poi_name,))
                        existing = cur.fetchone()
                        if existing:
                            print(f"⚠️  Zaten mevcut: {poi_name}")
                            skipped_count += 1
                            continue
                except Exception as e:
                    print(f"⚠️  Kontrol hatası ({poi_name}): {e}")
                
                # POI'yi ekle
                poi_id = db.add_poi(poi_data)
                if poi_id:
                    print(f"✅ Eklendi: {poi_name} (ID: {poi_id}, Kategori: {category})")
                    added_count += 1
                else:
                    print(f"❌ Eklenemedi: {poi_name}")
                    
            except Exception as e:
                print(f"❌ Hata ({poi_name}): {e}")
        
        print(f"\n📊 İmport Özeti:")
        print(f"   ✅ Eklenen: {added_count}")
        print(f"   ⚠️  Atlanan: {skipped_count}")
        print(f"   📍 Toplam: {len(POI_DATA)}")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Veritabanı hatası: {e}")
        return False

def main():
    print("🚀 POI Verilerini İmport Etme Başlıyor...")
    print(f"📍 {len(POI_DATA)} POI verisi işlenecek")
    
    # Kategorileri göster
    categories = {}
    for name in POI_DATA.keys():
        cat = categorize_poi(name)
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📋 Kategori Dağılımı:")
    for cat, count in categories.items():
        print(f"   {cat}: {count} adet")
    
    print("\n" + "="*50)
    
    success = import_pois()
    
    if success:
        print("\n🎉 POI import işlemi başarıyla tamamlandı!")
    else:
        print("\n❌ POI import işlemi başarısız oldu.")
        sys.exit(1)

if __name__ == "__main__":
    main()