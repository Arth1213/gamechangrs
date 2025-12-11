import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const faqCategories = [
    {
      title: "Getting Started",
      icon: "🚀",
      questions: [
        {
          q: "How do I get started with GameChangrs?",
          a: "Simply create an account, and you'll have access to all our features. Start by uploading a video for AI coaching analysis, or browse the marketplace for gear. No credit card required to get started!",
        },
        {
          q: "Do I need to pay to use the platform?",
          a: "Basic features are free! You can upload videos for analysis, browse the marketplace, and track your progress. Premium features may be available in the future for advanced analytics and coaching insights.",
        },
        {
          q: "What sports does GameChangrs support?",
          a: "Currently, we focus on cricket coaching with batting and bowling analysis. We're working on expanding to other sports in the future!",
        },
      ],
    },
    {
      title: "AI Coaching",
      icon: "🤖",
      questions: [
        {
          q: "How does the AI coaching analysis work?",
          a: "Our AI uses advanced pose detection technology to analyze your technique frame-by-frame. It measures angles, body positions, and movement patterns, then provides detailed feedback and improvement recommendations.",
        },
        {
          q: "What video format should I use?",
          a: "We support most common video formats (MP4, MOV, AVI). For best results, film from a side-on angle with good lighting, ensuring your full body is visible throughout the movement.",
        },
        {
          q: "How accurate is the analysis?",
          a: "Our AI is trained on professional athlete data and provides highly accurate pose detection. However, the analysis is meant to supplement, not replace, professional coaching. Always consult with a qualified coach for comprehensive training.",
        },
        {
          q: "Can I save my analysis results?",
          a: "Yes! All your analyses are automatically saved to your account. You can view them anytime from your dashboard and track your progress over time.",
        },
      ],
    },
    {
      title: "TechniqueAI",
      icon: "🧠",
      questions: [
        {
          q: "What is TechniqueAI?",
          a: "TechniqueAI is our advanced real-time pose detection tool. It provides instant biomechanical analysis with angle measurements, helping you understand your body positioning during technique execution.",
        },
        {
          q: "Do I need special equipment?",
          a: "No special equipment needed! Just use your phone or webcam. TechniqueAI works with any device that has a camera.",
        },
        {
          q: "Is my video data stored?",
          a: "Your privacy is important to us. Videos are processed in real-time and not stored unless you explicitly choose to save your analysis. Saved analyses only contain pose data, not the original video.",
        },
      ],
    },
    {
      title: "Marketplace",
      icon: "🛒",
      questions: [
        {
          q: "How does the marketplace work?",
          a: "The marketplace connects buyers and sellers directly. You can list gear for sale or donation, and buyers can contact you via email. We facilitate the connection but don't process payments - you arrange transactions directly.",
        },
        {
          q: "Is it free to list items?",
          a: "Yes! Listing items is completely free. We believe in making sports equipment accessible to everyone.",
        },
        {
          q: "How do I contact a seller?",
          a: "Click the 'Contact' button on any listing. You'll be able to send a message directly to the seller via email. Your email address will be shared with the seller for communication.",
        },
        {
          q: "Can I donate gear instead of selling?",
          a: "Absolutely! When creating a listing, choose 'Donation' as the listing type. Your gear will be marked as free and help support underprivileged young athletes.",
        },
        {
          q: "What happens to proceeds from sales?",
          a: "All transactions are between buyers and sellers. However, many sellers choose to donate a portion of their proceeds to support our mission of providing gear to underprivileged athletes.",
        },
      ],
    },
    {
      title: "Analytics",
      icon: "📊",
      questions: [
        {
          q: "What analytics are available?",
          a: "You can track your analysis scores over time, view detailed breakdowns of your technique, and see improvement trends. We're working on integrating with CricClubs for team and league analytics.",
        },
        {
          q: "Can coaches access player analytics?",
          a: "Currently, analytics are private to each user. Team analytics features are coming soon, allowing coaches to view aggregated team performance data.",
        },
        {
          q: "How do I connect my CricClubs account?",
          a: "CricClubs integration is coming soon! You'll be able to connect your account to automatically sync match data and get enhanced analytics.",
        },
      ],
    },
    {
      title: "Account & Privacy",
      icon: "🔒",
      questions: [
        {
          q: "How do I reset my password?",
          a: "Go to Settings and click 'Reset Password'. You'll receive an email with instructions to create a new password.",
        },
        {
          q: "Can I delete my account?",
          a: "Yes, you can delete your account from the Settings page. This will permanently remove all your data, including analyses and listings. This action cannot be undone.",
        },
        {
          q: "Is my data secure?",
          a: "Absolutely. We use industry-standard encryption and security practices. Your videos and personal information are protected and never shared with third parties without your consent.",
        },
        {
          q: "How do I update my profile?",
          a: "Navigate to Settings from your dashboard. You can update your name, location, and notification preferences there.",
        },
      ],
    },
  ];

  const allQuestions = faqCategories.flatMap((category) =>
    category.questions.map((q) => ({ ...q, category: category.title }))
  );

  const filteredQuestions = searchQuery
    ? allQuestions.filter(
        (item) =>
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allQuestions;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <HelpCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Frequently Asked Questions</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              How can we <span className="text-gradient-primary">help you?</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Find answers to common questions about GameChangrs
            </p>

            {/* Search */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg"
              />
            </div>
          </div>

          {/* FAQ Content */}
          {searchQuery ? (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-bold text-foreground">
                Search Results ({filteredQuestions.length})
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {filteredQuestions.map((item, index) => (
                  <AccordionItem key={index} value={`search-${index}`}>
                    <AccordionTrigger className="text-left">
                      <div>
                        <p className="font-semibold">{item.q}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="space-y-8">
              {faqCategories.map((category, catIndex) => (
                <div key={catIndex} className="rounded-2xl bg-gradient-card border border-border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-3xl">{category.icon}</span>
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      {category.title}
                    </h2>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((item, qIndex) => (
                      <AccordionItem key={qIndex} value={`${catIndex}-${qIndex}`}>
                        <AccordionTrigger className="text-left font-semibold">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          )}

          {/* Still have questions */}
          <div className="mt-12 rounded-2xl bg-gradient-card border border-border p-8 text-center">
            <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">
              Still have questions?
            </h3>
            <p className="text-muted-foreground mb-6">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <Button variant="hero" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;

