import { useEffect } from 'react';

/** Canonical site URL used in structured data and meta tags. */
const SITE_URL = 'https://3s.igentechnology.net';

/**
 * JSON-LD structured data schemas for SEO and GEO (Generative Engine Optimization).
 *
 * Includes:
 * 1. HealthClub (LocalBusiness) — Google Maps, Knowledge Panel, AI entity recognition
 * 2. FAQPage — Rich snippets + AI citation source
 * 3. WebSite — Sitelinks Search Box
 * 4. BreadcrumbList — Rich breadcrumb snippets
 */
function buildSchemas() {
  const healthClub = {
    '@context': 'https://schema.org',
    '@type': 'HealthClub',
    'name': '3S Wellness Fitness & Yoga',
    'alternateName': '3S Gym Bắc Ninh',
    'description':
      'Tổ hợp thể thao cao cấp tại Bắc Ninh gồm Gym & Fitness, Yoga Therapy chuyên sâu cùng Master Ấn Độ, Zumba Dance và Kickfit Boxing. Đội ngũ HLV PT cá nhân chuẩn quốc tế, đo chỉ số InBody miễn phí.',
    'url': SITE_URL,
    'telephone': '+84889926222',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Tầng 5, Tòa nhà VNPT, 33 Lý Thái Tổ',
      'addressLocality': 'Thành phố Bắc Ninh',
      'addressRegion': 'Bắc Ninh',
      'postalCode': '16000',
      'addressCountry': 'VN',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': 21.1861,
      'longitude': 106.0763,
    },
    'openingHoursSpecification': {
      '@type': 'OpeningHoursSpecification',
      'dayOfWeek': [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      'opens': '05:30',
      'closes': '21:00',
    },
    'priceRange': '$$',
    'image': `${SITE_URL}/images/banner_reception.jpg`,
    'logo': `${SITE_URL}/images/logo-white.png`,
    'sameAs': [
      'https://facebook.com/3sgym',
      'https://instagram.com/3sgym',
    ],
    'amenityFeature': [
      { '@type': 'LocationFeatureSpecification', 'name': 'Gym & Fitness', 'value': true },
      { '@type': 'LocationFeatureSpecification', 'name': 'Yoga Therapy', 'value': true },
      { '@type': 'LocationFeatureSpecification', 'name': 'Zumba Dance', 'value': true },
      { '@type': 'LocationFeatureSpecification', 'name': 'Kickfit & Boxing', 'value': true },
      { '@type': 'LocationFeatureSpecification', 'name': 'InBody Analysis', 'value': true },
      { '@type': 'LocationFeatureSpecification', 'name': 'Personal Trainer (PT)', 'value': true },
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'Phòng tập 3S Gym Bắc Ninh nằm ở vị trí nào?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': '3S Wellness Fitness & Yoga nằm tại Tầng 5 Tòa nhà VNPT - 33 Lý Thái Tổ, Thành phố Bắc Ninh. Vị trí trung tâm sầm uất, đỗ xe ô tô và xe máy rộng rãi miễn phí.',
        },
      },
      {
        '@type': 'Question',
        'name': 'Tôi mới bắt đầu tập thì có được hướng dẫn không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Có! 100% hội viên mới đều được hỗ trợ đo chỉ số cơ thể InBody miễn phí, phân tích thể trạng bằng AI và được HLV PT hướng dẫn sử dụng máy móc an toàn.',
        },
      },
      {
        '@type': 'Question',
        'name': '3S Gym có những bộ môn tập luyện nào?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Tổ hợp 3S Gym bao gồm trọn gói: Gym & Fitness thể hình, Yoga Therapy chuyên sâu với Master Ấn Độ, Zumba Dance sôi động và Kickfit/Boxing đối kháng.',
        },
      },
      {
        '@type': 'Question',
        'name': 'Giờ mở cửa của phòng tập 3S Gym như thế nào?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Phòng Gym mở cửa đón hội viên từ 05:30 sáng đến 21:00 tối tất cả các ngày trong tuần (kể cả Thứ 7 & Chủ Nhật).',
        },
      },
      {
        '@type': 'Question',
        'name': '3S Gym có dịch vụ PT cá nhân không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Có! 3S Gym sở hữu đội ngũ Huấn luyện viên cá nhân (PT) được đào tạo chuẩn quốc tế, đồng hành 1-on-1 với giáo án cá nhân hóa dựa trên phân tích chỉ số InBody và mục tiêu riêng của từng hội viên.',
        },
      },
      {
        '@type': 'Question',
        'name': '3S Gym có lớp Yoga cho người mới bắt đầu không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Có! 3S Gym cung cấp lớp Yoga Therapy nhiều cấp độ từ cơ bản đến nâng cao, do Master đến từ Ấn Độ trực tiếp hướng dẫn. Lớp Yoga cơ bản phù hợp cho người mới, tập trung giãn cơ trị liệu và cân bằng Thân - Tâm - Trí.',
        },
      },
      {
        '@type': 'Question',
        'name': 'Phòng tập 3S Gym Bắc Ninh có gì khác biệt so với các phòng gym khác?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': '3S Gym là tổ hợp thể thao cao cấp duy nhất tại Bắc Ninh tích hợp 4 bộ môn: Gym, Yoga, Zumba và Kickfit trong cùng một không gian. 100% máy móc nhập khẩu chuẩn quốc tế, hệ thống AI phân tích chỉ số InBody và giáo án dinh dưỡng cá nhân hóa cho từng hội viên.',
        },
      },
    ],
  };

  const webSite = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': '3S Wellness Fitness & Yoga',
    'url': SITE_URL,
    'inLanguage': 'vi',
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Trang Chủ',
        'item': `${SITE_URL}/`,
      },
    ],
  };

  return [healthClub, faqPage, webSite, breadcrumb];
}

/**
 * SeoHead — Injects JSON-LD structured data into <head> for SEO & GEO.
 *
 * Renders as a hidden component (no visible UI). Place it once inside
 * the LandingPage component so schemas are only present on the public page.
 */
export default function SeoHead() {
  useEffect(() => {
    const schemas = buildSchemas();
    const scripts: HTMLScriptElement[] = [];

    for (const schema of schemas) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
      scripts.push(script);
    }

    return () => {
      for (const script of scripts) {
        script.remove();
      }
    };
  }, []);

  return null;
}

/** Exported for testing. */
export { buildSchemas, SITE_URL };
