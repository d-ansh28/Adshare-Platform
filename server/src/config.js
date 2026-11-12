export const PRICING = {
  text:  { advertiserPaise: 100, userPaise: 10, label: 'Text + link' },
  image: { advertiserPaise: 500, userPaise: 50, label: 'Image + link' },
  video: { advertiserPaise: 1000, userPaise: 100, label: 'Video + title + link' }
};
export const MIN_WITHDRAWAL_PAISE = 100000;
export const RAZORPAY_PROFILE_URL = process.env.RAZORPAY_PROFILE_URL || 'https://razorpay.me/@Presently';
