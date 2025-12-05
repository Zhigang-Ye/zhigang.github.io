import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { Lang, BioData, MultiLangString } from '../types';
import { TRANSLATIONS } from '../constants';

interface BiographyProps {
  lang: Lang;
}

const Biography: React.FC<BiographyProps> = ({ lang }) => {
  const [data, setData] = useState<BioData | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const manifestRes = await fetch('./manifest.json');
        const manifest = await manifestRes.json();
        
        const bioRes = await fetch(manifest.biography);
        const bioData = await bioRes.json();
        
        setData(bioData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading biography:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const { firstName, lastName, email, subject, message } = formData;
    const fullName = `${firstName} ${lastName}`;
    const emailBody = `Name: ${fullName}\nEmail: ${email}\n\nMessage:\n${message}`;
    
    const recipient = data.contact.email;
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.location.href = mailtoLink;
  };

  const getLangString = (obj: MultiLangString) => {
    return obj[lang] || obj['en'];
  };

  if (loading) {
     return <div className="w-full min-h-screen bg-white" />;
  }

  if (!data) return null;

  const { contact, timeline, exhibitions } = data;

  const secondaryStyle = { fontFamily: '"Doto", sans-serif' };
  const secondaryClass = "text-[#F22C2C]";
  
  return (
    <div className="w-full min-h-screen bg-white px-6 md:px-12 py-10 md:py-10 max-w-5xl mx-auto text-black">
      
      {/* 1. Name & Timeline Section */}
      <div className="mb-16">
        <div className="border-b border-black pb-2 mb-6">
          <h1 className="font-normal text-base">{getLangString(contact.name)}</h1>
          {/* Location Subtitle - Always English for Doto text */}
          {contact.location && (
             <p 
               style={secondaryStyle}
               className={`text-sm mt-1 ${secondaryClass}`}
             >
               {contact.location['en']}
             </p>
          )}
        </div>
        
        <div className="grid grid-cols-[100px_1fr] md:grid-cols-[140px_1fr] gap-x-4 gap-y-4 text-base">
          {timeline.map((item, idx) => (
            <React.Fragment key={idx}>
              <div 
                style={secondaryStyle} 
                className={`text-sm pt-0.5 ${secondaryClass}`}
              >
                {item.year}
              </div>
              <div className="text-black">
                {getLangString(item.text)}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 2. Exhibitions Section */}
      <div className="mb-16">
        <div className="border-b border-black pb-2 mb-6">
          <h2 className="text-base font-normal">{TRANSLATIONS.SELECTED_EXHIBITIONS[lang]}</h2>
        </div>
        <div className="grid grid-cols-[100px_1fr] md:grid-cols-[140px_1fr] gap-x-4 gap-y-4 text-base">
          {exhibitions.map((item, idx) => (
            <React.Fragment key={idx}>
              <div 
                style={secondaryStyle} 
                className={`text-sm pt-0.5 ${secondaryClass}`}
              >
                {item.year}
              </div>
              <div className="text-black">
                {getLangString(item.text)}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 3. Contact Section */}
      <div className="mb-16">
         <div className="border-b border-black pb-2 mb-6">
          <h2 className="text-base font-normal">{TRANSLATIONS.CONTACT[lang]}</h2>
        </div>
        <div className="space-y-1 text-base">
           {contact.phones.map((phone, idx) => (
             <div key={idx}>
                {/* Rule: Secondary text always English */}
                <span style={secondaryStyle} className={secondaryClass}>{TRANSLATIONS.TEL_LABEL['en']}: </span>
                {phone}
             </div>
           ))}
           <div>
             <span style={secondaryStyle} className={secondaryClass}>{TRANSLATIONS.EMAIL_LABEL['en']}: </span>
             <a 
               href={`mailto:${contact.email}`} 
               className="hover:text-[#F22C2C] transition-colors"
             >
               {contact.email}
             </a>
           </div>
           <div>
             <span style={secondaryStyle} className={secondaryClass}>ins: </span>
             <a 
               href={`https://instagram.com/${contact.instagram}`} 
               target="_blank" 
               rel="noreferrer"
               className="hover:text-[#F22C2C] transition-colors"
             >
               {contact.instagram}
             </a>
           </div>
        </div>
      </div>

      {/* 4. Message Form Section */}
      <div className="mb-20">
        <form onSubmit={handleSubmit} className="space-y-10 max-w-3xl">
          
          {/* Name Row */}
          <div>
            <label className="block text-base mb-2">
              {TRANSLATIONS.NAME_LABEL[lang]} 
              <span 
                style={secondaryStyle} 
                className={`text-xs ml-2 ${secondaryClass}`}
              >
                {/* Rule: Secondary text always English */}
                {TRANSLATIONS.NAME_REQUIRED_HINT['en']}
              </span>
            </label>
            <div className="flex flex-col md:flex-row gap-6 md:gap-10">
              <div className="flex-1">
                <span 
                  style={secondaryStyle} 
                  className={`text-xs mb-1 block ${secondaryClass}`}
                >
                  {TRANSLATIONS.FIRST_NAME['en']}
                </span>
                <input 
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full border-b border-black py-2 bg-transparent focus:outline-none focus:border-[#F22C2C] transition-colors rounded-none"
                />
              </div>
              <div className="flex-1">
                <span 
                  style={secondaryStyle} 
                  className={`text-xs mb-1 block ${secondaryClass}`}
                >
                  {TRANSLATIONS.LAST_NAME['en']}
                </span>
                <input 
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full border-b border-black py-2 bg-transparent focus:outline-none focus:border-[#F22C2C] transition-colors rounded-none"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-base mb-1">
              {TRANSLATIONS.EMAIL[lang]} 
              <span 
                style={secondaryStyle} 
                className={`text-xs ml-2 ${secondaryClass}`}
              >
                {TRANSLATIONS.NAME_REQUIRED_HINT['en']}
              </span>
            </label>
            <input 
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full border-b border-black py-2 bg-transparent focus:outline-none focus:border-[#F22C2C] transition-colors rounded-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-base mb-1">
              {TRANSLATIONS.SUBJECT[lang]} 
              <span 
                style={secondaryStyle} 
                className={`text-xs ml-2 ${secondaryClass}`}
              >
                {TRANSLATIONS.NAME_REQUIRED_HINT['en']}
              </span>
            </label>
            <input 
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              required
              className="w-full border-b border-black py-2 bg-transparent focus:outline-none focus:border-[#F22C2C] transition-colors rounded-none"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-base mb-1">
              {TRANSLATIONS.MESSAGE[lang]} 
              <span 
                style={secondaryStyle} 
                className={`text-xs ml-2 ${secondaryClass}`}
              >
                {TRANSLATIONS.NAME_REQUIRED_HINT['en']}
              </span>
            </label>
            <textarea 
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              required
              rows={1}
              style={{ minHeight: '40px' }}
              className="w-full border-b border-black py-2 bg-transparent focus:outline-none focus:border-[#F22C2C] transition-colors resize-y rounded-none"
              onInput={(e) => {
                 const target = e.target as HTMLTextAreaElement;
                 target.style.height = 'auto';
                 target.style.height = target.scrollHeight + 'px';
              }}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-8">
            <button 
              type="submit"
              className="px-8 py-2 text-gray-400 hover:text-black transition-colors duration-300 text-base"
            >
              {TRANSLATIONS.SEND[lang]}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};

export default Biography;