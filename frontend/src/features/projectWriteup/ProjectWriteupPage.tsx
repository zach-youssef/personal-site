import React, { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import ButtonLink from '../ButtonLink';
import { fetchGraphQL } from '../../FetchHelper';
import { SiteText, SiteTextContents } from '../../content/text/SiteText';
import ArticleCards from './ArticleCards';
import WriteupFigure from './WriteupFigure';
import WriteupVideo from './WriteupVideo';
import { PROJECT_WRITEUP_QUERY, ProjectWriteupResponse } from './ProjectWriteup';

type Load =
    | { state: 'loading' }
    | { state: 'failed' }
    | { state: 'loaded', data: ProjectWriteupResponse };

// A project's page: its write-up beside the card's image or a video, then links to the project and
// the articles about it
function ProjectWriteupPage({ id }: { id: string }) {
    const [load, setLoad] = useState<Load>({ state: 'loading' });

    useEffect(() => {
        let isMounted = true;
        fetchGraphQL(PROJECT_WRITEUP_QUERY, { id }).then(response => {
            if (!isMounted) {
                return;
            }
            const data = response?.data as ProjectWriteupResponse | undefined;
            setLoad(data?.projectInfo && data.projectWriteup
                ? { state: 'loaded', data }
                : { state: 'failed' });
        }).catch(error => {
            console.error(error);
            if (isMounted) {
                setLoad({ state: 'failed' });
            }
        });
        return () => {
            isMounted = false;
        };
    }, [id]);

    if (load.state === 'loading') {
        return null;
    }
    if (load.state === 'failed') {
        return <Container><p className="text-muted">{SiteTextContents[SiteText.WriteupLoadFailed]}</p></Container>;
    }

    const { name, imagePath } = load.data.projectInfo!;
    const { context, imageAlt, video, sections, links, articles } = load.data.projectWriteup!;
    return (
        <Container className="project-writeup">
            <h2>{name}</h2>
            <p className="text-muted">{context}</p>
            <Row>
                <Col lg={7}>
                    {sections.map((section, index) => (
                        <section key={index}>
                            {section.heading && <h4>{section.heading}</h4>}
                            {section.paragraphs.map((paragraph, paragraphIndex) =>
                                <p key={paragraphIndex}>{paragraph}</p>)}
                            {section.figures.map(figure => <WriteupFigure key={figure.src} figure={figure}/>)}
                        </section>
                    ))}
                    {links.length > 0 && (
                        <div className="writeup-links mb-4">
                            {links.map(link => (
                                <ButtonLink key={link.url} variant="primary" href={link.url} className="me-2 mb-2">{link.title}</ButtonLink>
                            ))}
                        </div>
                    )}
                </Col>
                <Col lg={5}>
                    {video
                        ? <WriteupVideo video={video}/>
                        // The card's image, so it's usually cached already; near the top, so not lazy
                        : <img src={imagePath} alt={imageAlt ?? ''} className="img-fluid rounded mb-4"/>}
                </Col>
            </Row>
            {articles.length > 0 && (
                <>
                    <h3>{SiteTextContents[SiteText.ArticlesHeader]}</h3>
                    <ArticleCards articles={articles}/>
                </>
            )}
        </Container>
    );
}

export default ProjectWriteupPage;
