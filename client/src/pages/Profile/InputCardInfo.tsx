import React, { useState } from 'react';
import './InputCardInfo.css';

interface CardInfo {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

interface InputCardInfoProps {
  onSubmit?: (cardInfo: CardInfo) => void;
}

const InputCardInfo: React.FC<InputCardInfoProps> = ({ onSubmit }) => {
  const [cardInfo, setCardInfo] = useState<CardInfo>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(cardInfo);
    }
  };

  return (
    <div className="container">
      <h2 className="title">Add Payment Method</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="cardNumber">Card Number</label>
          <input
            type="text"
            id="cardNumber"
            name="cardNumber"
            className="input"
            value={cardInfo.cardNumber}
            onChange={handleChange}
            placeholder="1234 5678 9012 3456"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="expiryDate">Expiry Date</label>
          <input
            type="text"
            id="expiryDate"
            name="expiryDate"
            className="input"
            value={cardInfo.expiryDate}
            onChange={handleChange}
            placeholder="MM/YY"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="cvv">CVV</label>
          <input
            type="text"
            id="cvv"
            name="cvv"
            className="input"
            value={cardInfo.cvv}
            onChange={handleChange}
            placeholder="123"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="cardholderName">Cardholder Name</label>
          <input
            type="text"
            id="cardholderName"
            name="cardholderName"
            className="input"
            value={cardInfo.cardholderName}
            onChange={handleChange}
            placeholder="John Doe"
            required
          />
        </div>

        <button type="submit" className="button">Add Card</button>
      </form>
    </div>
  );
};

export default InputCardInfo; 
